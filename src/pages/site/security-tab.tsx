import { useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { KeyIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-state"
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
import { useApi } from "@/lib/auth"
import { useAction } from "@/lib/use-action"
import type { Site } from "@/lib/api"

const IPV4_RE =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const IPV6_RE = /^[0-9a-fA-F:]{2,39}$/

// Accepts a plain IP or CIDR (the input placeholder advertises CIDR, e.g.
// 10.0.0.0/8). The prefix length is range-checked per family.
function isValidIP(value: string): boolean {
  let prefix: number | null = null
  const slash = value.indexOf("/")
  if (slash !== -1) {
    const p = value.slice(slash + 1)
    if (!/^\d{1,3}$/.test(p)) return false
    prefix = Number(p)
    value = value.slice(0, slash)
  }
  if (IPV4_RE.test(value)) return prefix === null || prefix <= 32
  if (value.includes(":") && IPV6_RE.test(value))
    return prefix === null || prefix <= 128
  return false
}

function describeProxyRule(configJson: string): string {
  try {
    const cfg = JSON.parse(configJson) as Record<string, string>
    return Object.entries(cfg)
      .map(([k, v]) => `${k}=${v}`)
      .join("  ")
  } catch {
    return configJson
  }
}

export function SecurityTab({ site }: { site: Site }) {
  const { api } = useApi()
  const [ip, setIp] = useState("")
  const [ipError, setIpError] = useState<string | null>(null)
  const [ftpUser, setFtpUser] = useState("")
  const [ftpPass, setFtpPass] = useState("")

  const proxy = useQuery({
    queryKey: ["proxy", site.domain],
    queryFn: () => api.listProxyRules(site.domain),
  })
  const ips = useQuery({
    queryKey: ["ip-rules", site.domain],
    queryFn: () => api.listIPRules(site.domain),
  })
  const ftp = useQuery({
    queryKey: ["ftp", site.domain],
    queryFn: () => api.listFTP(site.domain),
  })

  const allow = useAction({
    fn: (address: string) => api.allowIP(site.domain, address),
    invalidates: [["ip-rules", site.domain]],
    successTitle: "IP allowed",
    onSuccess: () => setIp(""),
  })
  const unblock = useAction({
    fn: (address: string) => api.unblockIP(site.domain, address),
    invalidates: [["ip-rules", site.domain]],
    successTitle: "Rule removed",
  })
  const removeProxy = useAction({
    fn: (id: number) => api.removeProxyRule(site.domain, id),
    invalidates: [["proxy", site.domain]],
    successTitle: "Rule removed",
  })
  const addFtp = useAction({
    fn: () => api.addFTP(site.domain, ftpUser.trim(), ftpPass),
    invalidates: [["ftp", site.domain]],
    successTitle: "FTP account created",
    onSuccess: () => {
      setFtpUser("")
      setFtpPass("")
    },
  })
  const removeFtp = useAction({
    fn: (username: string) => api.removeFTP(site.domain, username),
    invalidates: [["ftp", site.domain]],
    successTitle: "FTP account removed",
  })

  function submitIP() {
    setIpError(null)
    const address = ip.trim()
    if (!isValidIP(address)) {
      setIpError("Enter a valid IP address or CIDR, e.g. 203.0.113.7 or 10.0.0.0/8.")
      return
    }
    allow.mutate(address)
  }

  const hasAllowRule = (ips.data ?? []).some((r) => r.action === "allow")

  function handleAddFtp(e: FormEvent) {
    e.preventDefault()
    if (ftpUser.trim() && ftpPass) addFtp.mutate()
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>IP access</CardTitle>
          <CardDescription>
            Restrict which source addresses can reach this site at the reverse
            proxy. Adding an <strong>allow</strong> rule switches the site to
            allowlist mode — only listed IPs/CIDRs can reach it; everything else
            is denied.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          {hasAllowRule && (
            <Badge variant="secondary" className="self-start">
              Allowlist active — only allowed IPs can reach this site
            </Badge>
          )}
          <form
            className="flex flex-wrap items-start gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              submitIP()
            }}
          >
            <div className="flex flex-col gap-1">
              <Input
                placeholder="203.0.113.7 or 10.0.0.0/8"
                autoComplete="off"
                spellCheck={false}
                className="w-56 font-mono"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
              />
              {ipError && (
                <p className="text-destructive-foreground text-xs">{ipError}</p>
              )}
            </div>
            <Button type="submit" disabled={!ip.trim() || allow.isPending}>
              {allow.isPending ? <Spinner className="size-4" /> : <PlusIcon />}
              Allow
            </Button>
          </form>

          {ips.isPending && <LoadingRows rows={1} />}
          {ips.isError && <ErrorState error={ips.error} />}
          {ips.data &&
            (ips.data.length === 0 ? (
              <p className="text-muted-foreground text-sm">No IP rules.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ips.data.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <code className="font-mono text-sm">{rule.ip}</code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            rule.action === "allow" ? "secondary" : "outline"
                          }
                        >
                          {rule.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={unblock.isPending}
                          onClick={() => unblock.mutate(rule.ip)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proxy rules</CardTitle>
          <CardDescription>
            Redirects, custom headers, and basic auth applied at the edge. Add
            rules via the CLI:{" "}
            <code className="font-mono text-xs">apod proxy add {site.domain} …</code>
          </CardDescription>
        </CardHeader>
        <CardPanel>
          {proxy.isPending && <LoadingRows rows={1} />}
          {proxy.isError && <ErrorState error={proxy.error} />}
          {proxy.data &&
            (proxy.data.length === 0 ? (
              <EmptyState title="No proxy rules" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Config</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proxy.data.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Badge variant="secondary">{rule.rule_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="block max-w-80 truncate font-mono text-sm">
                          {describeProxyRule(rule.config)}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove rule #${rule.id}`}
                            >
                              <Trash2Icon />
                            </Button>
                          }
                          title="Remove proxy rule"
                          description="The rule stops applying as soon as it is removed."
                          confirmLabel="Remove"
                          onConfirm={() => removeProxy.mutateAsync(rule.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FTP / SFTP accounts</CardTitle>
          <CardDescription>
            Chrooted accounts with access to this site's files only. Use a
            strong password — it cannot be recovered later.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          <form className="flex flex-wrap items-center gap-2" onSubmit={handleAddFtp}>
            <Input
              placeholder="username"
              autoComplete="off"
              spellCheck={false}
              className="w-44"
              value={ftpUser}
              onChange={(e) => setFtpUser(e.target.value)}
            />
            <Input
              type="password"
              placeholder="password"
              autoComplete="new-password"
              className="w-44"
              value={ftpPass}
              onChange={(e) => setFtpPass(e.target.value)}
            />
            <Button
              type="submit"
              disabled={!ftpUser.trim() || !ftpPass || addFtp.isPending}
            >
              {addFtp.isPending ? <Spinner className="size-4" /> : <PlusIcon />}
              Add account
            </Button>
          </form>

          {ftp.isPending && <LoadingRows rows={1} />}
          {ftp.isError && <ErrorState error={ftp.error} />}
          {ftp.data &&
            (ftp.data.length === 0 ? (
              <p className="text-muted-foreground text-sm">No FTP accounts.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ftp.data.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <span className="flex items-center gap-2 font-medium">
                          <KeyIcon className="size-4 text-muted-foreground" />
                          {account.username}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${account.username}`}
                            >
                              <Trash2Icon />
                            </Button>
                          }
                          title="Remove FTP account"
                          description={`${account.username} will immediately lose file access.`}
                          confirmLabel="Remove"
                          onConfirm={() => removeFtp.mutateAsync(account.username)}
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
  )
}
