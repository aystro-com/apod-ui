import { useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { EyeIcon, EyeOffIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { CopyButton } from "@/components/copy-button"
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useApi } from "@/lib/auth"
import { useAction } from "@/lib/use-action"
import type { Site } from "@/lib/api"

const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

function ValueCell({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <span className="flex items-center gap-1">
      <code className="max-w-60 truncate font-mono text-sm">
        {revealed ? value : "••••••••"}
      </code>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={revealed ? "Hide value" : "Reveal value"}
        onClick={() => setRevealed((r) => !r)}
      >
        {revealed ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
      <CopyButton value={value} />
    </span>
  )
}

export function EnvTab({ site }: { site: Site }) {
  const { api } = useApi()
  const [key, setKey] = useState("")
  const [value, setValue] = useState("")
  const [keyError, setKeyError] = useState<string | null>(null)

  const env = useQuery({
    queryKey: ["env", site.domain],
    queryFn: () => api.listEnv(site.domain),
  })

  const set = useAction({
    fn: (vars: { key: string; value: string }) =>
      api.setEnv(site.domain, vars.key, vars.value),
    invalidates: [["env", site.domain]],
    successTitle: "Variable saved",
    onSuccess: () => {
      setKey("")
      setValue("")
    },
  })
  const unset = useAction({
    fn: (k: string) => api.unsetEnv(site.domain, k),
    invalidates: [["env", site.domain]],
    successTitle: "Variable removed",
  })

  function handleSet(e: FormEvent) {
    e.preventDefault()
    setKeyError(null)
    const k = key.trim()
    if (!ENV_KEY_RE.test(k)) {
      setKeyError("Keys must match [A-Za-z_][A-Za-z0-9_]* (e.g. DB_HOST).")
      return
    }
    set.mutate({ key: k, value })
  }

  const entries = Object.entries(env.data ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  )

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Environment variables</CardTitle>
        <CardDescription>
          Injected into the site's containers. Changes apply on the next
          restart or deploy. Values are masked by default.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <form className="flex flex-wrap items-start gap-2" onSubmit={handleSet}>
          <div className="flex flex-col gap-1">
            <Input
              placeholder="KEY"
              autoComplete="off"
              spellCheck={false}
              className="w-44 font-mono"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            {keyError && <p className="text-destructive-foreground text-xs">{keyError}</p>}
          </div>
          <Input
            placeholder="value"
            autoComplete="off"
            spellCheck={false}
            className="w-64 font-mono"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" disabled={!key.trim() || set.isPending}>
            {set.isPending ? <Spinner className="size-4" /> : <PlusIcon />}
            Set
          </Button>
        </form>

        {env.isPending && <LoadingRows rows={3} />}
        {env.isError && <ErrorState error={env.error} />}
        {env.data &&
          (entries.length === 0 ? (
            <EmptyState
              title="No environment variables"
              description="Set a variable above to make it available to the site."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell>
                      <code className="font-medium font-mono text-sm">{k}</code>
                    </TableCell>
                    <TableCell>
                      <ValueCell value={v} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${k}`}
                          >
                            <Trash2Icon />
                          </Button>
                        }
                        title="Remove variable"
                        description={`${k} will be removed from the site's environment on the next restart.`}
                        confirmLabel="Remove"
                        onConfirm={() => unset.mutateAsync(k)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}
      </CardPanel>
    </Card>
  )
}
