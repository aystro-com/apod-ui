import { useQuery } from "@tanstack/react-query"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useState } from "react"
import { CopyButton } from "@/components/copy-button"
import { ErrorState, LoadingRows } from "@/components/data-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { useApi } from "@/lib/auth"
import { formatDate, formatMB } from "@/lib/format"
import type { Site } from "@/lib/api"

const SECRET_KEY_RE = /(pass|secret|key|token)/i

function InfoRow({ name, value }: { name: string; value: string }) {
  const [revealed, setRevealed] = useState(false)
  const secret = SECRET_KEY_RE.test(name)
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="shrink-0 font-medium text-muted-foreground text-sm">
        {name}
      </span>
      <span className="flex min-w-0 items-center gap-1">
        <code className="truncate font-mono text-sm">
          {secret && !revealed ? "••••••••••••" : value}
        </code>
        {secret && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={revealed ? "Hide value" : "Reveal value"}
            onClick={() => setRevealed((r) => !r)}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        )}
        <CopyButton value={value} />
      </span>
    </div>
  )
}

export function OverviewTab({ site }: { site: Site }) {
  const { api } = useApi()
  const running = site.status === "running"

  const monitor = useQuery({
    queryKey: ["site-monitor", site.domain],
    queryFn: () => api.monitorSite(site.domain),
    enabled: running,
    refetchInterval: 30_000,
  })
  const info = useQuery({
    queryKey: ["site-info", site.domain],
    queryFn: () => api.getSiteInfo(site.domain),
  })

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Live resources</CardTitle>
          <CardDescription>Container CPU and memory usage.</CardDescription>
        </CardHeader>
        <CardPanel>
          {!running && (
            <p className="text-muted-foreground text-sm">
              The site is not running. Start it to see live usage.
            </p>
          )}
          {running && monitor.isPending && <LoadingRows rows={2} />}
          {running && monitor.isError && <ErrorState error={monitor.error} />}
          {running && monitor.data && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-sm">CPU</span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {monitor.data.cpu_percent.toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(monitor.data.cpu_percent, 100)} />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-sm">Memory</span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {formatMB(monitor.data.memory_mb)}
                    {monitor.data.memory_limit_mb > 0 &&
                      ` / ${formatMB(monitor.data.memory_limit_mb)}`}
                  </span>
                </div>
                <Progress value={Math.min(monitor.data.memory_percent, 100)} />
              </div>
            </div>
          )}
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Configuration and generated credentials for this site.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col">
          <div className="flex items-center justify-between gap-4 py-2">
            <span className="font-medium text-muted-foreground text-sm">Created</span>
            <span className="text-sm">{formatDate(site.created_at)}</span>
          </div>
          {site.repo && (
            <div className="flex items-center justify-between gap-4 py-2">
              <span className="font-medium text-muted-foreground text-sm">
                Repository
              </span>
              <code className="truncate font-mono text-sm">{site.repo}</code>
            </div>
          )}
          {site.branch && (
            <div className="flex items-center justify-between gap-4 py-2">
              <span className="font-medium text-muted-foreground text-sm">Branch</span>
              <code className="font-mono text-sm">{site.branch}</code>
            </div>
          )}
          {info.data?.url && (
            <div className="flex items-center justify-between gap-4 py-2">
              <span className="font-medium text-muted-foreground text-sm">url</span>
              <code className="truncate font-mono text-sm">{info.data.url}</code>
            </div>
          )}
          {info.data?.secrets && Object.keys(info.data.secrets).length > 0 && (
            <>
              <Separator className="my-2" />
              {Object.entries(info.data.secrets).map(([k, v]) => (
                <InfoRow key={k} name={k} value={String(v)} />
              ))}
            </>
          )}
          {info.isPending && <LoadingRows rows={2} />}
        </CardPanel>
      </Card>
    </div>
  )
}
