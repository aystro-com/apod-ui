import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { type ComponentType } from "react"
import {
  ArrowLeftIcon,
  ArrowUpCircleIcon,
  ExternalLinkIcon,
  PlayIcon,
  RotateCwIcon,
  SquareIcon,
} from "lucide-react"
import { DeployProgress } from "@/components/deploy-progress"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { ErrorState, LoadingRows } from "@/components/data-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardPanel } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs"
import { toastManager } from "@/components/ui/toast"
import { useApi } from "@/lib/auth"
import { useSiteEventStream } from "@/lib/use-site-stream"
import { timeAgo } from "@/lib/format"
import type { Site } from "@/lib/api"
import { ArchitectureTab } from "@/pages/site/architecture-tab"
import { BackupsTab } from "@/pages/site/backups-tab"
import { ConsoleTab } from "@/pages/site/console-tab"
import { CronTab } from "@/pages/site/cron-tab"
import { DeploysTab } from "@/pages/site/deploys-tab"
import { DomainsTab } from "@/pages/site/domains-tab"
import { EnvTab } from "@/pages/site/env-tab"
import { LogsTab } from "@/pages/site/logs-tab"
import { OverviewTab } from "@/pages/site/overview-tab"
import { SecurityTab } from "@/pages/site/security-tab"
import { SettingsTab } from "@/pages/site/settings-tab"
import { UptimeTab } from "@/pages/site/uptime-tab"

const TABS = [
  { path: "", label: "Overview" },
  { path: "architecture", label: "Architecture" },
  { path: "deploys", label: "Deploys" },
  { path: "domains", label: "Domains" },
  { path: "env", label: "Environment" },
  { path: "backups", label: "Backups" },
  { path: "cron", label: "Cron" },
  { path: "security", label: "Security" },
  { path: "uptime", label: "Uptime" },
  { path: "logs", label: "Logs" },
  { path: "console", label: "Console" },
  { path: "settings", label: "Settings" },
]

const TAB_COMPONENTS: Record<string, ComponentType<{ site: Site }>> = {
  "": OverviewTab,
  architecture: ArchitectureTab,
  deploys: DeploysTab,
  domains: DomainsTab,
  env: EnvTab,
  backups: BackupsTab,
  cron: CronTab,
  security: SecurityTab,
  uptime: UptimeTab,
  logs: LogsTab,
  console: ConsoleTab,
  settings: SettingsTab,
}

export function SiteDetailPage() {
  const params = useParams({ strict: false }) as { domain?: string; _splat?: string }
  const domain = params.domain ?? ""
  const { api } = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const site = useQuery({
    queryKey: ["site", domain],
    queryFn: () => api.getSite(domain),
    enabled: !!domain,
  })

  // Live "what is this site busy with" poll. While an operation holds the site
  // lock (deploying, restarting, backing up…), this drives the banner that
  // explains why other actions return "site is busy" — refreshed quickly so it
  // feels live, and slowed right down when idle.
  const activity = useQuery({
    queryKey: ["activity", domain],
    queryFn: () => api.getSiteActivity(domain),
    enabled: !!domain,
    refetchInterval: (q) => (q.state.data?.held ? 2000 : 5000),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["site", domain] })
    queryClient.invalidateQueries({ queryKey: ["sites"] })
    queryClient.invalidateQueries({ queryKey: ["monitor"] })
    queryClient.invalidateQueries({ queryKey: ["activity", domain] })
  }

  // Flip the busy banner on the instant an action starts, rather than waiting
  // for the next activity poll to notice the server-side lock.
  const bumpActivity = () =>
    queryClient.invalidateQueries({ queryKey: ["activity", domain] })

  const lifecycle = useMutation({
    mutationFn: ({ action }: { action: "start" | "stop" | "restart" }) => {
      if (action === "start") return api.startSite(domain)
      if (action === "stop") return api.stopSite(domain)
      return api.restartSite(domain)
    },
    onMutate: bumpActivity,
    onSuccess: (_d, { action }) => {
      invalidate()
      toastManager.add({
        title: `Site ${action === "stop" ? "stopped" : action === "start" ? "started" : "restarted"}`,
        type: "success",
      })
    },
    onError: (err) =>
      toastManager.add({
        title: "Action failed",
        description: err instanceof Error ? err.message : undefined,
        type: "error",
      }),
  })

  // Pull the latest image(s) and recreate containers. Live progress is shown by
  // the shared busy banner below (driven by the site event stream), so there's
  // no bespoke streaming here anymore.
  const update = useMutation({
    mutationFn: () => api.updateSite(domain),
    onMutate: bumpActivity,
    onSuccess: () => {
      invalidate()
      toastManager.add({ title: "Updated to latest", type: "success" })
    },
    onError: (err) =>
      toastManager.add({
        title: "Update failed",
        description: err instanceof Error ? err.message : undefined,
        type: "error",
      }),
  })

  // A long operation is in flight if the server reports the lock held, or a
  // page-initiated action is still pending (covers the gap before the next
  // poll). While busy we stream live steps for the banner.
  const pendingLabel = update.isPending
    ? "updating"
    : lifecycle.isPending
      ? lifecycle.variables?.action === "stop"
        ? "stopping"
        : lifecycle.variables?.action === "start"
          ? "starting"
          : "restarting"
      : undefined
  const busy = !!activity.data?.held || update.isPending || lifecycle.isPending
  const opLabel = activity.data?.operation ?? pendingLabel ?? "working"
  const opEvents = useSiteEventStream(domain, busy)

  const base = `/sites/${encodeURIComponent(domain)}`
  const splat = (params._splat ?? "").split("/")[0]
  const activeTab = TABS.some((t) => t.path === splat) ? splat : ""
  const ActiveTab = TAB_COMPONENTS[activeTab] ?? OverviewTab

  if (site.isPending) return <LoadingRows rows={6} />
  if (site.isError) {
    return (
      <>
        <Button variant="ghost" className="self-start" render={<Link to="/sites" />}>
          <ArrowLeftIcon />
          Back to sites
        </Button>
        <ErrorState error={site.error} />
      </>
    )
  }

  const s = site.data
  const running = s.status === "running"

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {s.domain}
            <StatusBadge status={s.status} />
            <Badge variant="secondary">{s.driver}</Badge>
          </span>
        }
        description={
          <>
            {s.ram} RAM · {s.cpu} CPU{s.storage ? ` · ${s.storage} disk` : ""} ·
            owned by {s.owner || "admin"}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              render={
                <a
                  href={`https://${s.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLinkIcon />
              Visit
            </Button>
            <Button
              variant="outline"
              disabled={update.isPending}
              onClick={() => update.mutate()}
              title="Pull the latest image(s) and recreate containers"
            >
              {update.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <ArrowUpCircleIcon />
              )}
              Update
            </Button>
            {running ? (
              <>
                <Button
                  variant="outline"
                  disabled={lifecycle.isPending}
                  onClick={() => lifecycle.mutate({ action: "restart" })}
                >
                  {lifecycle.isPending ? (
                    <Spinner className="size-4" />
                  ) : (
                    <RotateCwIcon />
                  )}
                  Restart
                </Button>
                <Button
                  variant="outline"
                  disabled={lifecycle.isPending}
                  onClick={() => lifecycle.mutate({ action: "stop" })}
                >
                  <SquareIcon />
                  Stop
                </Button>
              </>
            ) : (
              <Button
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate({ action: "start" })}
              >
                {lifecycle.isPending ? <Spinner className="size-4" /> : <PlayIcon />}
                Start
              </Button>
            )}
          </>
        }
      />

      {busy && (
        <Card className="border-info/40 bg-info/5">
          <CardPanel className="flex flex-col gap-3 py-3">
            <div className="flex items-center gap-3">
              <Spinner className="size-4 text-info" />
              <div className="flex flex-col">
                <span className="font-medium capitalize">{opLabel}…</span>
                <span className="text-muted-foreground text-xs">
                  This site is busy
                  {activity.data?.since
                    ? ` — started ${timeAgo(activity.data.since)}`
                    : ""}
                  . Other actions are blocked until it finishes — you can leave
                  this page, it keeps running.
                </span>
              </div>
            </div>
            {opEvents.length > 0 && <DeployProgress events={opEvents} />}
          </CardPanel>
        </Card>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          navigate({ to: value ? `${base}/${value}` : base })
        }}
      >
        <TabsList variant="underline" className="max-w-full overflow-x-auto">
          {TABS.map((t) => (
            <TabsTab key={t.path} value={t.path}>
              {t.label}
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>

      {/* Key by domain so switching sites (via URL/history, which doesn't
          remount the route) resets tab-local state — a stale console token,
          unsaved settings edits, or a revealed secret must never carry from
          one site to another. */}
      <ActiveTab key={s.domain} site={s} />
    </>
  )
}
