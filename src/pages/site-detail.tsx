import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import type { ComponentType } from "react"
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  PlayIcon,
  RotateCwIcon,
  SquareIcon,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { ErrorState, LoadingRows } from "@/components/data-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs"
import { toastManager } from "@/components/ui/toast"
import { useApi } from "@/lib/auth"
import type { Site } from "@/lib/api"
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["site", domain] })
    queryClient.invalidateQueries({ queryKey: ["sites"] })
    queryClient.invalidateQueries({ queryKey: ["monitor"] })
  }

  const lifecycle = useMutation({
    mutationFn: ({ action }: { action: "start" | "stop" | "restart" }) => {
      if (action === "start") return api.startSite(domain)
      if (action === "stop") return api.stopSite(domain)
      return api.restartSite(domain)
    },
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

      <ActiveTab site={s} />
    </>
  )
}
