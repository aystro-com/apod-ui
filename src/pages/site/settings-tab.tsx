import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { CopyIcon, SaveIcon, Trash2Icon } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { LoadingRows } from "@/components/data-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { toastManager } from "@/components/ui/toast"
import { useApi } from "@/lib/auth"
import { useAction } from "@/lib/use-action"
import type { Site } from "@/lib/api"

// Editable config keys supported by `apod config set`.
const CONFIG_FIELDS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: "ram", label: "RAM limit", placeholder: "512M" },
  { key: "cpu", label: "CPU cores", placeholder: "1" },
  { key: "storage", label: "Disk quota", placeholder: "5G" },
  { key: "repo", label: "Git repository", placeholder: "https://github.com/you/app.git" },
  { key: "branch", label: "Git branch", placeholder: "main" },
]

// fieldError mirrors the server-side validation (engine.validateConfigValue) so
// mistakes are caught before save. Returns a message, or null when valid.
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

function fieldError(key: string, value: string): string | null {
  const v = value.trim()
  switch (key) {
    case "storage":
      // Empty = unlimited (same as site creation allows), so clearing an
      // existing quota must be permitted — the ram-style "required" rule made
      // that impossible.
      if (v === "") return null
      return /^\d+[MG]$/i.test(v)
        ? null
        : "Use an integer followed by M or G (e.g. 512M, 2G), or leave blank for unlimited."
    case "ram":
      if (v === "") return "Required — an integer + M or G (e.g. 512M, 2G)."
      return /^\d+[MG]$/i.test(v)
        ? null
        : "Use an integer followed by M or G (e.g. 512M, 2G)."
    case "cpu": {
      const n = Number(v)
      return v !== "" && /^\d+(\.\d+)?$/.test(v) && n > 0 && n <= 256
        ? null
        : "A positive number of cores (e.g. 0.5, 1, 2)."
    }
    case "repo":
      if (v === "") return null
      return /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/.test(v) && !v.includes("::")
        ? null
        : "Must be an http(s) or ssh git URL."
    case "branch":
      if (v === "") return null
      return /^[A-Za-z0-9._/-]+$/.test(v) && !v.startsWith("-") && !v.includes("..")
        ? null
        : "Only letters, digits and ._/- are allowed."
    default:
      return null
  }
}

export function SettingsTab({ site }: { site: Site }) {
  const { api, session } = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = session.role === "admin"

  const config = useQuery({
    queryKey: ["config", site.domain],
    queryFn: () => api.getConfig(site.domain),
  })
  const users = useQuery({
    queryKey: ["users"],
    queryFn: api.listUsers,
    enabled: isAdmin,
  })

  // User edits overlay the fetched config; only touched keys are stored here.
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [cloneTarget, setCloneTarget] = useState("")
  const [transferTo, setTransferTo] = useState("")
  const [purge, setPurge] = useState(false)

  const values: Record<string, string> = { ...config.data, ...edits }

  // Only block on fields the user actually changed, so a pre-existing empty
  // optional field (e.g. no disk quota set yet) doesn't wedge the form.
  const hasErrors = Object.keys(edits).some(
    (key) => fieldError(key, edits[key] ?? "") !== null,
  )

  const save = useAction({
    fn: async () => {
      const original = config.data ?? {}
      const changed = CONFIG_FIELDS.filter(
        ({ key }) =>
          key in edits && (edits[key] ?? "") !== (original[key] ?? ""),
      )
      // The API takes one key per call.
      for (const { key } of changed) {
        await api.setConfig(site.domain, key, edits[key] ?? "")
      }
      return changed.length
    },
    invalidates: [["config", site.domain], ["site", site.domain], ["sites"]],
    onSuccess: (count) => {
      setEdits({})
      toastManager.add({
        title:
          count === 0
            ? "Nothing to save"
            : `Saved ${count} setting${count === 1 ? "" : "s"}`,
        type: count === 0 ? "info" : "success",
      })
    },
  })

  const clone = useAction({
    fn: () => api.cloneSite(site.domain, cloneTarget.trim().toLowerCase()),
    invalidates: [["sites"]],
    successTitle: "Site cloned",
    onSuccess: () => setCloneTarget(""),
  })
  // Validate the clone target client-side (mirrors create); it must be a valid
  // domain and different from the source.
  const cloneNormalized = cloneTarget.trim().toLowerCase()
  const cloneInvalid =
    cloneNormalized !== "" &&
    (!DOMAIN_RE.test(cloneNormalized) || cloneNormalized === site.domain)

  const transfer = useAction({
    fn: (owner: string) => api.transferSite(site.domain, owner),
    invalidates: [["site", site.domain], ["sites"]],
    successTitle: "Ownership transferred",
  })

  const destroy = useAction({
    fn: () => api.destroySite(site.domain, purge),
    // Flip the busy banner + live progress stream the instant destroy starts,
    // rather than waiting for the next activity poll to notice the lock (a fast
    // destroy can otherwise finish before the poll, showing no progress at all).
    onMutate: () =>
      queryClient.invalidateQueries({ queryKey: ["activity", site.domain] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] })
      toastManager.add({ title: "Site destroyed", type: "success" })
      navigate({ to: "/sites" })
    },
  })

  function handleSave(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Resource limits are kernel-enforced. Changes apply on the next
            restart.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          {config.isPending && <LoadingRows rows={3} />}
          {config.data && (
            <form className="flex flex-col gap-4" onSubmit={handleSave}>
              <div className="grid gap-4 sm:grid-cols-2">
                {CONFIG_FIELDS.map(({ key, label, placeholder }) => {
                  // Show the error only once the user has touched the field.
                  const err =
                    key in edits ? fieldError(key, edits[key] ?? "") : null
                  return (
                    <div key={key} className="flex flex-col gap-2">
                      <Label htmlFor={`cfg-${key}`}>{label}</Label>
                      <Input
                        id={`cfg-${key}`}
                        placeholder={placeholder}
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={err ? true : undefined}
                        value={values[key] ?? ""}
                        onChange={(e) =>
                          setEdits((v) => ({ ...v, [key]: e.target.value }))
                        }
                      />
                      {err && (
                        <span className="text-destructive-foreground text-xs">
                          {err}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              <Button
                type="submit"
                className="self-start"
                disabled={save.isPending || hasErrors}
              >
                {save.isPending ? <Spinner className="size-4" /> : <SaveIcon />}
                Save changes
              </Button>
            </form>
          )}
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clone site</CardTitle>
          <CardDescription>
            Creates a full copy — files, databases, and configuration — under a
            new domain.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="copy.example.com (target domain)"
            autoComplete="off"
            spellCheck={false}
            className="w-72"
            value={cloneTarget}
            onChange={(e) => setCloneTarget(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={!cloneTarget.trim() || cloneInvalid || clone.isPending}
            onClick={() => clone.mutate()}
          >
            {clone.isPending ? <Spinner className="size-4" /> : <CopyIcon />}
            Clone
          </Button>
          {cloneInvalid && (
            <p className="text-destructive-foreground w-full text-xs">
              Enter a valid target domain different from the current one.
            </p>
          )}
        </CardPanel>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Transfer ownership</CardTitle>
            <CardDescription>
              Moves the site and its files to another user's account.
            </CardDescription>
          </CardHeader>
          <CardPanel className="flex flex-wrap items-center gap-2">
            <Select value={transferTo} onValueChange={(v) => setTransferTo(v as string)}>
              <SelectTrigger className="w-56">
                <SelectValue>
                  {(v: string) => (v ? v : "admin (unassigned)")}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="">admin (unassigned)</SelectItem>
                {(users.data ?? [])
                  .filter((u) => u.name !== site.owner)
                  .map((u) => (
                    <SelectItem key={u.name} value={u.name}>
                      {u.name}
                    </SelectItem>
                  ))}
              </SelectPopup>
            </Select>
            <ConfirmDialog
              trigger={
                <Button variant="outline" disabled={transfer.isPending}>
                  Transfer
                </Button>
              }
              title="Transfer site ownership"
              description={`${site.domain} will be moved to ${transferTo || "the admin account"}. File ownership and quotas are updated accordingly.`}
              confirmLabel="Transfer"
              destructive={false}
              onConfirm={() => transfer.mutateAsync(transferTo)}
            />
          </CardPanel>
        </Card>
      )}

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive-foreground">Danger zone</CardTitle>
          <CardDescription>
            Destroying a site stops and removes its containers. With "purge"
            enabled, all files, databases, and backups are deleted permanently.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col items-start gap-4">
          <Label className="flex items-center gap-2 font-normal text-sm">
            <Checkbox
              checked={purge}
              onCheckedChange={(checked) => setPurge(checked === true)}
            />
            Also delete all data (purge)
          </Label>
          <ConfirmDialog
            trigger={
              <Button variant="destructive">
                <Trash2Icon />
                Destroy site
              </Button>
            }
            title={`Destroy ${site.domain}`}
            description={
              purge
                ? "Containers, files, databases, and backups will be permanently deleted. This cannot be undone."
                : "Containers will be removed. Files and data are kept on disk and the domain is freed."
            }
            confirmLabel="Destroy"
            typeToConfirm={site.domain}
            onConfirm={() => destroy.mutateAsync()}
          />
        </CardPanel>
      </Card>
    </div>
  )
}
