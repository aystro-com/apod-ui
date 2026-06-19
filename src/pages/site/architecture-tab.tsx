import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  BoxIcon,
  ClockIcon,
  CpuIcon,
  DatabaseIcon,
  GlobeIcon,
  LinkIcon,
  MinusIcon,
  NetworkIcon,
  PlusIcon,
  RotateCwIcon,
  ServerIcon,
  ShieldCheckIcon,
  TerminalIcon,
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
import type { NetworkNeighbor, ProcessInfo, Site } from "@/lib/api"

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
    <Card className="w-64 gap-0 overflow-hidden rounded-xl">
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

        {(proc.containers ?? []).length > 0 && (
          <div className="flex flex-col gap-1.5 border-t pt-2">
            {(proc.containers ?? []).map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex min-w-0 flex-col">
                  <code className="truncate font-mono text-[11px] text-muted-foreground">
                    {c.name}
                  </code>
                  {c.ip ? (
                    <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/70">
                      <NetworkIcon className="size-2.5" />
                      {c.ip}
                    </span>
                  ) : (
                    !c.running && (
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        stopped — no IP
                      </span>
                    )
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Open console in ${c.name}`}
                  title="Open console"
                  render={
                    <Link
                      to="/sites/$domain/$"
                      params={{ domain, _splat: "console" }}
                      search={{ service: proc.service }}
                    />
                  }
                >
                  <TerminalIcon />
                </Button>
              </div>
            ))}
          </div>
        )}

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
            {/* Every service can be restarted, including plain backing
                services like the database (role ""). */}
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
        )}
      </div>
    </Card>
  )
}

export function ArchitectureTab({ site }: { site: Site }) {
  const { api } = useApi()
  const procs = useQuery({
    queryKey: ["processes", site.domain],
    queryFn: () => api.listProcesses(site.domain),
  })
  // Neighbors this site can reach over shared networks (deliberate links).
  const neighbors = useQuery({
    queryKey: ["site-network", site.domain],
    queryFn: () => api.getSiteNetwork(site.domain),
  })

  if (procs.isPending) return <LoadingRows rows={3} />
  if (procs.isError) return <ErrorState error={procs.error} />

  // Group reachable neighbor containers by the shared network they're on.
  const byNetwork = new Map<string, NetworkNeighbor[]>()
  for (const n of neighbors.data ?? []) {
    const list = byNetwork.get(n.network) ?? []
    list.push(n)
    byNetwork.set(n.network, list)
  }

  const all = procs.data ?? []
  // Group by role, but only keep groups that actually have containers — sites
  // vary (a single web container, web+db, a worker fleet, …), so we render what
  // exists instead of forcing fixed App/Workers/Services slots with empty
  // placeholders.
  const knownRoles = new Set(["web", "worker", "scheduler"])
  const groups = [
    { key: "web", title: "Web", icon: GlobeIcon },
    { key: "worker", title: "Workers", icon: CpuIcon },
    { key: "scheduler", title: "Scheduler", icon: ClockIcon },
    { key: "service", title: "Services", icon: ServerIcon },
  ]
    .map((g) => ({
      ...g,
      procs: all.filter((p) =>
        g.key === "service" ? !knownRoles.has(p.role) : p.role === g.key,
      ),
    }))
    .filter((g) => g.procs.length > 0)

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
            {all.length === 0 ? (
              <EmptyNode label="No containers running" />
            ) : (
              groups.map((g) => (
                <CanvasColumn key={g.key} title={g.title} icon={g.icon}>
                  {g.procs.map((p) => (
                    <ProcessNode
                      key={p.service}
                      proc={p}
                      domain={site.domain}
                    />
                  ))}
                </CanvasColumn>
              ))
            )}
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-muted-foreground text-xs">
            <ShieldCheckIcon className="size-3.5 text-emerald-600" />
            {byNetwork.size === 0
              ? "These containers share one private network. No other site can reach them."
              : "Isolated by default — except the shared networks below, which this site is deliberately joined to."}
          </p>
        </CardPanel>
      </Card>

      {byNetwork.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="size-4 text-muted-foreground" />
              Shared networks
            </CardTitle>
            <CardDescription>
              Containers from other sites that {site.domain} can reach privately,
              by name or by the IP shown.
            </CardDescription>
          </CardHeader>
          <CardPanel className="flex flex-col gap-5">
            {[...byNetwork.entries()].map(([network, items]) => (
              <div
                key={network}
                className="overflow-hidden rounded-xl border-2 border-dashed border-sky-500/40"
              >
                <div className="flex items-center gap-2 border-b bg-sky-500/5 px-4 py-2 font-medium text-sm">
                  <NetworkIcon className="size-4 text-sky-600" />
                  {network}
                  <code className="rounded bg-background px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                    apod-net-{network}
                  </code>
                </div>
                <div className="flex flex-wrap items-start gap-3 p-4">
                  {items.map((n) => (
                    <NeighborNode key={n.name} neighbor={n} />
                  ))}
                </div>
              </div>
            ))}
          </CardPanel>
        </Card>
      )}
    </div>
  )
}

/** A read-only node for a reachable container on another site. */
function NeighborNode({ neighbor }: { neighbor: NetworkNeighbor }) {
  return (
    <Card className="w-60 gap-0 overflow-hidden rounded-xl bg-muted/30">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="flex items-center gap-2 truncate font-medium text-sm">
          <BoxIcon className="size-4 text-muted-foreground" />
          {neighbor.service || "container"}
        </span>
        <span
          className={`size-2 shrink-0 rounded-full ${neighbor.running ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          title={neighbor.running ? "running" : "stopped"}
        />
      </div>
      <div className="flex flex-col gap-1 px-3 py-2 text-xs">
        <span className="truncate text-muted-foreground">{neighbor.site}</span>
        <code className="truncate font-mono text-[11px] text-muted-foreground">
          {neighbor.name}
        </code>
        {neighbor.ip ? (
          <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/70">
            <NetworkIcon className="size-2.5" />
            {neighbor.ip}
          </span>
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {neighbor.running ? "no shared IP" : "stopped — joins on start"}
          </span>
        )}
      </div>
    </Card>
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
