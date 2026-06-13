import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-state"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardPanel } from "@/components/ui/card"
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

export function ActivityPage() {
  const { api } = useApi()
  const logs = useQuery({ queryKey: ["logs"], queryFn: api.allLogs })

  return (
    <>
      <PageHeader
        title="Activity"
        description="Every operation across all sites, newest first."
      />
      <Card>
        <CardPanel>
          {logs.isPending && <LoadingRows rows={6} />}
          {logs.isError && <ErrorState error={logs.error} />}
          {logs.data &&
            (logs.data.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Operations like create, deploy, and backup will appear here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.data.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>
                        {op.site_domain ? (
                          <Link
                            className="font-medium hover:underline"
                            to="/sites/$domain" params={{ domain: op.site_domain }}
                          >
                            {op.site_domain}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">server</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{op.action}</TableCell>
                      <TableCell className="max-w-80 truncate text-muted-foreground text-sm">
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
    </>
  )
}
