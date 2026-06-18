import { useQuery } from "@tanstack/react-query"
import {
  ClockIcon,
  CpuIcon,
  DatabaseIcon,
  GlobeIcon,
  MinusIcon,
  PlusIcon,
  RotateCwIcon,
  ServerIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { ErrorState, LoadingRows } from "@/components/data-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { useApi } from "@/lib/auth"
import { useAction } from "@/lib/use-action"
import type { ProcessInfo, Site } from "@/lib/api"

const MAX_REPLICAS = 20

function roleLabel(role: string): string {
  switch (role) {
    case "web":
      return "Web"
    case "worker":
      return "Worker"
    case "scheduler":
      return "Scheduler"
    default:
      return "Service"
  }
}

function roleIconEl(role: string) {
  const cls = "size-4 text-muted-foreground"
  switch (role) {
    case "web":
      return <GlobeIcon className={cls} />
    case "worker":
      return <CpuIcon className={cls} />
    case "scheduler":
      return <ClockIcon className={cls} />
    default:
      return <DatabaseIcon className={cls} />
  }
}

/** One node card on the architecture canvas. */
function ProcessNode({
  proc,
  domain,
}: {
  proc: ProcessInfo
  domain: string
}) {
  const { api } = useApi()

  const scale = useAction({
    fn: (replicas: number) => api.scaleProcess(domain, proc.service, replicas),
    invalidates: [["processes", domain]],
    successTitle: "Scaled",
  })
  const restart = useAction({
    fn: () => api.restartProcess(domain, proc.service),
    invalidates: [["processes", domain]],
    successTitle: "Restart requested",
  })

  const busy = scale.isPending || restart.isPending

  return (
    <div className="w-64 rounded-lg border bg-background shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="flex items-center gap-2 font-medium text-sm">
          {roleIconEl(proc.role)}
          {proc.service}
        </span>
        <Badge variant={proc.role === "web" ? "default" : "secondary"}>
          {roleLabel(proc.role)}
        </Badge>
      </div>
      <div className="flex flex-col gap-2 px-3 py-2 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Replicas</span>
          <span className="font-mono text-foreground">
            {proc.running}/{proc.replicas} up
          </span>
        </div>

        {proc.scalable ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Scale ${proc.service} down`}
                disabled={busy || proc.replicas <= 0}
                onClick={() => scale.mutate(Math.max(0, proc.replicas - 1))}
              >
                <MinusIcon />
              </Button>
              <span className="w-8 text-center font-mono text-sm text-foreground">
                {proc.replicas}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Scale ${proc.service} up`}
                disabled={busy || proc.replicas >= MAX_REPLICAS}
                onClick={() =>
                  scale.mutate(Math.min(MAX_REPLICAS, proc.replicas + 1))
                }
              >
                <PlusIcon />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => restart.mutate(undefined)}
            >
              {restart.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <RotateCwIcon />
              )}
              Restart
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {proc.role === "scheduler" ? "Singleton" : "Managed"}
            </span>
            {proc.role !== "" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => restart.mutate(undefined)}
              >
                {restart.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  <RotateCwIcon />
                )}
                Restart
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function ArchitectureTab({ site }: { site: Site }) {
  const { api } = useApi()
  const procs = useQuery({
    queryKey: ["processes", site.domain],
    queryFn: () => api.listProcesses(site.domain),
  })

  if (procs.isPending) return <LoadingRows rows={3} />
  if (procs.isError) return <ErrorState error={procs.error} />

  const all = procs.data ?? []
  const web = all.filter((p) => p.role === "web")
  const workers = all.filter((p) => p.role === "worker")
  const scheduler = all.filter((p) => p.role === "scheduler")
  const services = all.filter(
    (p) => p.role === "" || (p.role !== "web" && p.role !== "worker" && p.role !== "scheduler"),
  )

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Architecture</CardTitle>
          <CardDescription>
            Every process of {site.domain} runs as its own isolated container(s)
            from the same image. Scale workers and restart processes here.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          {/* The site boundary: every process below runs inside one private,
              per-site network — a self-contained unit no other site can reach. */}
          <div className="overflow-hidden rounded-xl border-2 border-dashed">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
              <span className="flex items-center gap-2 font-medium text-sm">
                <ServerIcon className="size-4 text-muted-foreground" />
                {site.domain}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <ShieldCheckIcon className="size-3.5 text-emerald-600" />
                Isolated network
                <code className="rounded bg-background px-1 py-0.5 font-mono text-[10px]">
                  apod-site-{site.domain.replaceAll(".", "-")}
                </code>
              </span>
            </div>
            {/* Dotted-grid canvas, mirroring the cloud topology view. */}
            <div
              className="flex flex-wrap items-start gap-x-12 gap-y-6 p-6"
              style={{
                backgroundImage:
                  "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            >
            <CanvasColumn title="App" icon={GlobeIcon}>
              {web.length === 0 ? (
                <EmptyNode label="No web process" />
              ) : (
                web.map((p) => (
                  <ProcessNode key={p.service} proc={p} domain={site.domain} />
                ))
              )}
            </CanvasColumn>

            <CanvasColumn title="Workers" icon={CpuIcon}>
              {workers.length === 0 && scheduler.length === 0 ? (
                <EmptyNode label="No background processes" />
              ) : (
                <>
                  {workers.map((p) => (
                    <ProcessNode key={p.service} proc={p} domain={site.domain} />
                  ))}
                  {scheduler.map((p) => (
                    <ProcessNode key={p.service} proc={p} domain={site.domain} />
                  ))}
                </>
              )}
            </CanvasColumn>

            <CanvasColumn title="Services" icon={ServerIcon}>
              {services.length === 0 ? (
                <EmptyNode label="No backing services" />
              ) : (
                services.map((p) => (
                  <ProcessNode key={p.service} proc={p} domain={site.domain} />
                ))
              )}
            </CanvasColumn>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-muted-foreground text-xs">
            <ShieldCheckIcon className="size-3.5 text-emerald-600" />
            These containers share one private network. No other site can reach
            them.
          </p>
        </CardPanel>
      </Card>
    </div>
  )
}

function CanvasColumn({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof GlobeIcon
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        <Icon className="size-3.5" />
        {title}
      </span>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

function EmptyNode({ label }: { label: string }) {
  return (
    <div className="w-64 rounded-lg border border-dashed bg-background/60 px-3 py-6 text-center text-muted-foreground text-xs">
      {label}
    </div>
  )
}
