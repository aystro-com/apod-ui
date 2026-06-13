import { useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  DownloadIcon,
  FlameIcon,
  HardDriveIcon,
  KeyIcon,
  PackageIcon,
  PlusIcon,
  ShieldIcon,
  Trash2Icon,
} from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
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
import { Textarea } from "@/components/ui/textarea"
import { useApi } from "@/lib/auth"
import { useAction } from "@/lib/use-action"
import { formatMB } from "@/lib/format"

function isValidPort(value: string): boolean {
  // Accepts "8080" or "8080/tcp" style values.
  const portPart = value.split("/")[0]
  const n = Number(portPart)
  return /^\d+(\/(tcp|udp))?$/.test(value) && Number.isInteger(n) && n >= 1 && n <= 65535
}

export function SystemPage() {
  const { api } = useApi()
  const [port, setPort] = useState("")
  const [portError, setPortError] = useState<string | null>(null)
  const [keyName, setKeyName] = useState("")
  const [publicKey, setPublicKey] = useState("")

  const version = useQuery({ queryKey: ["version"], queryFn: api.version })
  const updateCheck = useQuery({
    queryKey: ["update-check"],
    queryFn: api.checkUpdate,
  })
  const drivers = useQuery({ queryKey: ["drivers"], queryFn: api.listDrivers })
  const firewall = useQuery({ queryKey: ["firewall"], queryFn: api.firewallStatus })
  const sshKeys = useQuery({ queryKey: ["ssh-keys"], queryFn: api.listSSHKeys })
  const diskUsage = useQuery({ queryKey: ["disk-usage"], queryFn: api.diskUsage })

  const update = useAction({
    fn: api.update,
    invalidates: [["version"], ["update-check"]],
    successTitle: "Update started — the daemon restarts automatically",
  })
  const updateDrivers = useAction({
    fn: api.updateDrivers,
    invalidates: [["drivers"]],
    successTitle: "Drivers updated",
  })
  const allowPort = useAction({
    fn: (p: string) => api.firewallAllow(p),
    invalidates: [["firewall"]],
    successTitle: "Port allowed",
    onSuccess: () => setPort(""),
  })
  const denyPort = useAction({
    fn: (p: string) => api.firewallDeny(p),
    invalidates: [["firewall"]],
    successTitle: "Port denied",
    onSuccess: () => setPort(""),
  })
  const enableFirewall = useAction({
    fn: api.firewallEnable,
    invalidates: [["firewall"]],
    successTitle: "Firewall enabled",
  })
  const addKey = useAction({
    fn: () => api.addSSHKey(keyName.trim(), publicKey.trim()),
    invalidates: [["ssh-keys"]],
    successTitle: "SSH key added",
    onSuccess: () => {
      setKeyName("")
      setPublicKey("")
    },
  })
  const removeKey = useAction({
    fn: (n: string) => api.removeSSHKey(n),
    invalidates: [["ssh-keys"]],
    successTitle: "SSH key removed",
  })

  function firewallAction(action: "allow" | "deny") {
    return (e: FormEvent) => {
      e.preventDefault()
      setPortError(null)
      const p = port.trim()
      if (!isValidPort(p)) {
        setPortError("Enter a valid port (1–65535), optionally with /tcp or /udp.")
        return
      }
      if (action === "allow") allowPort.mutate(p)
      else denyPort.mutate(p)
    }
  }

  function handleAddKey(e: FormEvent) {
    e.preventDefault()
    if (keyName.trim() && publicKey.trim()) addKey.mutate()
  }

  return (
    <>
      <PageHeader
        title="System"
        description="Server version, drivers, firewall, and SSH keys."
      />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageIcon className="size-4" />
                Version
              </CardTitle>
            </CardHeader>
            <CardPanel className="flex flex-col gap-3">
              {version.isPending && <LoadingRows rows={1} />}
              {version.data && (
                <p className="text-sm">
                  apod{" "}
                  <span className="font-mono font-semibold">
                    {version.data.version}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    (db schema v{version.data.db_version})
                  </span>
                </p>
              )}
              {updateCheck.data?.has_update && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>update available: {updateCheck.data.latest}</Badge>
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" disabled={update.isPending}>
                        {update.isPending ? (
                          <Spinner className="size-4" />
                        ) : (
                          <DownloadIcon />
                        )}
                        Update now
                      </Button>
                    }
                    title={`Update apod to ${updateCheck.data.latest}`}
                    description="The binary and drivers are updated and the daemon restarts. Running sites are not interrupted, but the API will be briefly unavailable."
                    confirmLabel="Update"
                    destructive={false}
                    onConfirm={() => update.mutateAsync()}
                  />
                </div>
              )}
              {updateCheck.data && !updateCheck.data.has_update && (
                <p className="text-muted-foreground text-sm">Up to date.</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                disabled={updateDrivers.isPending}
                onClick={() => updateDrivers.mutate()}
              >
                {updateDrivers.isPending && <Spinner className="size-4" />}
                Update drivers only
              </Button>
            </CardPanel>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlameIcon className="size-4" />
                Drivers
              </CardTitle>
              <CardDescription>
                Application stacks available for new sites.
              </CardDescription>
            </CardHeader>
            <CardPanel>
              {drivers.isPending && <LoadingRows rows={3} />}
              {drivers.isError && <ErrorState error={drivers.error} />}
              {drivers.data && (
                <ul className="flex flex-col gap-2">
                  {drivers.data.map((d) => (
                    <li key={d.name} className="flex items-baseline gap-2 text-sm">
                      <Badge variant="secondary">{d.name}</Badge>
                      <span className="text-muted-foreground">
                        {d.description || ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardPanel>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDriveIcon className="size-4" />
                Disk usage per site
              </CardTitle>
            </CardHeader>
            <CardPanel>
              {diskUsage.isPending && <LoadingRows rows={2} />}
              {diskUsage.data &&
                (diskUsage.data.length === 0 ? (
                  <EmptyState title="No sites" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Site</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diskUsage.data.map((d) => (
                        <TableRow key={d.domain}>
                          <TableCell className="font-medium">{d.domain}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMB(d.size_mb)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ))}
            </CardPanel>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldIcon className="size-4" />
                Firewall (UFW)
              </CardTitle>
              <CardDescription>
                Controls which ports are reachable from the internet.
              </CardDescription>
            </CardHeader>
            <CardPanel className="flex flex-col gap-4">
              {firewall.isPending && <LoadingRows rows={2} />}
              {firewall.isError && <ErrorState error={firewall.error} />}
              {firewall.data && (
                <>
                  {!firewall.data.enabled && (
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">disabled</Badge>
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="outline">
                            Enable firewall
                          </Button>
                        }
                        title="Enable UFW firewall"
                        description="Make sure SSH (22), HTTP (80), HTTPS (443), and the apod API port are allowed first, or you may lock yourself out."
                        confirmLabel="Enable"
                        onConfirm={() => enableFirewall.mutateAsync()}
                      />
                    </div>
                  )}
                  <form className="flex flex-wrap items-start gap-2">
                    <div className="flex flex-col gap-1">
                      <Input
                        placeholder="port, e.g. 8080"
                        autoComplete="off"
                        spellCheck={false}
                        className="w-40"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                      />
                      {portError && (
                        <p className="max-w-56 text-destructive-foreground text-xs">
                          {portError}
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={!port.trim() || allowPort.isPending}
                      onClick={firewallAction("allow")}
                    >
                      Allow
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!port.trim() || denyPort.isPending}
                      onClick={firewallAction("deny")}
                    >
                      Deny
                    </Button>
                  </form>
                  {(firewall.data.rules ?? []).length > 0 && (
                    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                      {(firewall.data.rules ?? []).join("\n")}
                    </pre>
                  )}
                </>
              )}
            </CardPanel>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyIcon className="size-4" />
                SSH keys
              </CardTitle>
              <CardDescription>
                Public keys authorized for server access.
              </CardDescription>
            </CardHeader>
            <CardPanel className="flex flex-col gap-4">
              <form className="flex flex-col gap-2" onSubmit={handleAddKey}>
                <Input
                  placeholder="key name, e.g. laptop"
                  autoComplete="off"
                  spellCheck={false}
                  className="max-w-56"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                />
                <Textarea
                  placeholder="ssh-ed25519 AAAA… user@host"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-h-20 font-mono text-xs"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                />
                <Button
                  type="submit"
                  className="self-start"
                  disabled={!keyName.trim() || !publicKey.trim() || addKey.isPending}
                >
                  {addKey.isPending ? <Spinner className="size-4" /> : <PlusIcon />}
                  Add key
                </Button>
              </form>

              {sshKeys.isPending && <LoadingRows rows={1} />}
              {sshKeys.data &&
                (sshKeys.data.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No keys added.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Key</TableHead>
                        <TableHead className="w-20 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sshKeys.data.map((k) => (
                        <TableRow key={k.name}>
                          <TableCell className="font-medium">{k.name}</TableCell>
                          <TableCell>
                            <code className="block max-w-56 truncate font-mono text-xs">
                              {k.public_key}
                            </code>
                          </TableCell>
                          <TableCell className="text-right">
                            <ConfirmDialog
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Remove key ${k.name}`}
                                >
                                  <Trash2Icon />
                                </Button>
                              }
                              title={`Remove SSH key ${k.name}`}
                              description="This key will no longer grant access to the server."
                              confirmLabel="Remove"
                              onConfirm={() => removeKey.mutateAsync(k.name)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ))}
            </CardPanel>
          </Card>
        </div>
      </div>
    </>
  )
}
