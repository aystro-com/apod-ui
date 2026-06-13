import { useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { ActivityIcon, BellIcon } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState, LoadingRows } from "@/components/data-state"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
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
import { ApiError } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { Site } from "@/lib/api"

const INTERVALS = ["30", "60", "120", "300"]

export function UptimeTab({ site }: { site: Site }) {
  const { api } = useApi()
  const [url, setUrl] = useState(`https://${site.domain}`)
  const [interval, setIntervalSec] = useState("60")
  const [alertWebhook, setAlertWebhook] = useState("")

  const status = useQuery({
    queryKey: ["uptime", site.domain],
    queryFn: () => api.uptimeStatus(site.domain),
    retry: false,
    refetchInterval: 60_000,
  })
  const notConfigured =
    status.isError &&
    status.error instanceof ApiError &&
    status.error.status === 404
  const logs = useQuery({
    queryKey: ["uptime-logs", site.domain],
    queryFn: () => api.uptimeLogs(site.domain),
    enabled: status.isSuccess,
    refetchInterval: 60_000,
  })

  const enable = useAction({
    fn: () =>
      api.enableUptime(
        site.domain,
        url.trim(),
        Number(interval),
        alertWebhook.trim() || undefined,
      ),
    invalidates: [["uptime", site.domain], ["uptime-logs", site.domain]],
    successTitle: "Uptime monitoring enabled",
  })
  const disable = useAction({
    fn: () => api.disableUptime(site.domain),
    invalidates: [["uptime", site.domain]],
    successTitle: "Uptime monitoring disabled",
  })

  function handleEnable(e: FormEvent) {
    e.preventDefault()
    if (url.trim()) enable.mutate()
  }

  if (status.isPending) return <LoadingRows rows={3} />

  if (notConfigured || !status.data) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Uptime monitoring</CardTitle>
          <CardDescription>
            Periodically checks an HTTP endpoint and can call a webhook on
            UP/DOWN transitions.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          <form className="flex flex-col gap-4" onSubmit={handleEnable}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="uptime-url">URL to check</Label>
              <Input
                id="uptime-url"
                type="url"
                autoComplete="off"
                spellCheck={false}
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="uptime-interval">Check interval</Label>
                <Select
                  value={interval}
                  onValueChange={(v) => setIntervalSec(v as string)}
                >
                  <SelectTrigger id="uptime-interval" className="w-36">
                    <SelectValue>{(v: string) => `every ${v}s`}</SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {INTERVALS.map((i) => (
                      <SelectItem key={i} value={i}>
                        every {i}s
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <div className="flex min-w-64 flex-1 flex-col gap-2">
                <Label htmlFor="uptime-webhook">
                  Alert webhook{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="uptime-webhook"
                  type="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://hooks.example.com/alert"
                  value={alertWebhook}
                  onChange={(e) => setAlertWebhook(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="self-start" disabled={enable.isPending}>
              {enable.isPending ? <Spinner className="size-4" /> : <ActivityIcon />}
              Enable monitoring
            </Button>
          </form>
        </CardPanel>
      </Card>
    )
  }

  const s = status.data

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Uptime monitoring
            <StatusBadge status={s.active ? "up" : "stopped"} />
          </CardTitle>
          <CardDescription>
            Checking <code className="font-mono text-xs">{s.url}</code> every{" "}
            {s.interval_seconds}s
            {s.alert_webhook && (
              <span className="ms-2 inline-flex items-center gap-1">
                <BellIcon className="size-3" /> webhook alerts on
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-muted-foreground text-xs">Uptime</p>
              <p className="font-semibold text-2xl tabular-nums">
                {s.uptime_percent != null ? `${s.uptime_percent.toFixed(2)}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Avg response</p>
              <p className="font-semibold text-2xl tabular-nums">
                {s.avg_response_ms != null ? `${s.avg_response_ms} ms` : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total checks</p>
              <p className="font-semibold text-2xl tabular-nums">{s.total_checks}</p>
            </div>
          </div>
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="self-start">
                Disable monitoring
              </Button>
            }
            title="Disable uptime monitoring"
            description="Checks will stop and no further alerts will be sent. Historical check data is kept."
            confirmLabel="Disable"
            onConfirm={() => disable.mutateAsync()}
          />
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent checks</CardTitle>
        </CardHeader>
        <CardPanel>
          {logs.isPending && <LoadingRows rows={3} />}
          {logs.data &&
            (logs.data.length === 0 ? (
              <EmptyState title="No checks yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {c.status_code || "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{c.response_ms} ms</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(c.created_at)}
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
