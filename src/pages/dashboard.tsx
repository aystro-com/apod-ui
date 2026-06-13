import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { CpuIcon, GlobeIcon, HardDriveIcon, MemoryStickIcon, PlusIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useApi } from "@/lib/auth"
import { formatMB } from "@/lib/format"

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  percent,
}: {
  icon: typeof CpuIcon
  label: string
  value: string
  detail?: string
  percent?: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <Icon className="size-3.5" />
          {label}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardPanel className="flex flex-col gap-2">
        {percent !== undefined && <Progress value={Math.min(percent, 100)} />}
        {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
      </CardPanel>
    </Card>
  )
}

export function DashboardPage() {
  const { api, session } = useApi()
  const isAdmin = session.role === "admin"

  const stats = useQuery({
    queryKey: ["server-stats"],
    queryFn: api.serverStats,
    enabled: isAdmin,
    refetchInterval: 30_000,
  })
  const monitor = useQuery({
    queryKey: ["monitor"],
    queryFn: api.monitorAll,
    refetchInterval: 30_000,
  })

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of your server and sites."
        actions={
          <Button render={<Link to="/sites/new" />}>
            <PlusIcon />
            New site
          </Button>
        }
      />

      {isAdmin && stats.data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={GlobeIcon}
            label="Sites"
            value={String(stats.data.site_count)}
            detail="Total sites on this server"
          />
          <StatCard
            icon={CpuIcon}
            label="CPU"
            value={`${stats.data.cpu_count} cores`}
            detail="Available processor cores"
          />
          <StatCard
            icon={MemoryStickIcon}
            label="Memory"
            value={`${stats.data.mem_percent.toFixed(0)}%`}
            detail={`${formatMB(stats.data.mem_used_mb)} of ${formatMB(stats.data.mem_total_mb)} used`}
            percent={stats.data.mem_percent}
          />
          <StatCard
            icon={HardDriveIcon}
            label="Disk"
            value={`${stats.data.disk_percent.toFixed(0)}%`}
            detail={`${stats.data.disk_used_gb} GB of ${stats.data.disk_total_gb} GB used`}
            percent={stats.data.disk_percent}
          />
        </div>
      )}
      {isAdmin && stats.isPending && <LoadingRows rows={2} />}

      <Card>
        <CardHeader>
          <CardTitle>Site resource usage</CardTitle>
          <CardDescription>
            Live CPU and memory per site, refreshed every 30 seconds.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          {monitor.isPending && <LoadingRows rows={4} />}
          {monitor.isError && <ErrorState error={monitor.error} />}
          {monitor.data &&
            (monitor.data.length === 0 ? (
              <EmptyState
                title="No sites yet"
                description="Create your first site to see resource usage here."
                action={
                  <Button render={<Link to="/sites/new" />} variant="outline">
                    <PlusIcon />
                    Create site
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">CPU</TableHead>
                    <TableHead className="text-right">Memory</TableHead>
                    <TableHead className="w-1/4">Memory usage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitor.data.map((s) => (
                    <TableRow key={s.domain}>
                      <TableCell>
                        <Link
                          className="font-medium hover:underline"
                          to="/sites/$domain" params={{ domain: s.domain }}
                        >
                          {s.domain}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.cpu_percent.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMB(s.memory_mb)}
                        {s.memory_limit_mb > 0 && (
                          <span className="text-muted-foreground">
                            {" "}
                            / {formatMB(s.memory_limit_mb)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Progress value={Math.min(s.memory_percent, 100)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}
        </CardPanel>
      </Card>
    </>
  )
}
