import { useQuery } from "@tanstack/react-query"
import { RotateCwIcon } from "lucide-react"
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-state"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useApi } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import type { Site } from "@/lib/api"

export function LogsTab({ site }: { site: Site }) {
  const { api } = useApi()

  const containerLogs = useQuery({
    queryKey: ["container-logs", site.domain],
    queryFn: () => api.containerLogs(site.domain),
  })
  const activity = useQuery({
    queryKey: ["site-logs", site.domain],
    queryFn: () => api.siteLogs(site.domain),
  })

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Container output</CardTitle>
          <CardDescription>
            Last 100 lines of stdout/stderr from the site's containers.
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={containerLogs.isFetching}
              onClick={() => containerLogs.refetch()}
            >
              <RotateCwIcon />
              Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <CardPanel>
          {containerLogs.isPending && <LoadingRows rows={4} />}
          {containerLogs.isError && <ErrorState error={containerLogs.error} />}
          {containerLogs.data &&
            (containerLogs.data.logs.trim() === "" ? (
              <p className="text-muted-foreground text-sm">
                No output yet. Logs appear once the containers write to
                stdout/stderr.
              </p>
            ) : (
              <ScrollArea className="max-h-96 rounded-lg border bg-muted/40">
                <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
                  {containerLogs.data.logs}
                </pre>
              </ScrollArea>
            ))}
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Every operation performed on this site.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          {activity.isPending && <LoadingRows rows={3} />}
          {activity.isError && <ErrorState error={activity.error} />}
          {activity.data &&
            (activity.data.length === 0 ? (
              <EmptyState title="No activity recorded" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.data.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="font-medium">{op.action}</TableCell>
                      <TableCell className="max-w-72 truncate text-muted-foreground text-sm">
                        {op.details || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={op.result} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(op.created_at)}
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
