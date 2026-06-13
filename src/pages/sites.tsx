import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { PlusIcon, SearchIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardPanel } from "@/components/ui/card"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useApi } from "@/lib/auth"
import { timeAgo } from "@/lib/format"

export function SitesPage() {
  const { api } = useApi()
  const [filter, setFilter] = useState("")

  const sites = useQuery({ queryKey: ["sites"], queryFn: api.listSites })

  const filtered = useMemo(() => {
    const list = sites.data ?? []
    const q = filter.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (s) =>
        s.domain.toLowerCase().includes(q) ||
        s.driver.toLowerCase().includes(q) ||
        (s.owner ?? "").toLowerCase().includes(q),
    )
  }, [sites.data, filter])

  return (
    <>
      <PageHeader
        title="Sites"
        description="Every site runs in its own isolated container stack."
        actions={
          <Button render={<Link to="/sites/new" />}>
            <PlusIcon />
            New site
          </Button>
        }
      />

      <InputGroup className="max-w-sm">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Filter by domain, driver, or owner…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </InputGroup>

      <Card>
        <CardPanel>
          {sites.isPending && <LoadingRows rows={5} />}
          {sites.isError && <ErrorState error={sites.error} />}
          {sites.data &&
            (filtered.length === 0 ? (
              <EmptyState
                title={filter ? "No matching sites" : "No sites yet"}
                description={
                  filter
                    ? "Try a different search."
                    : "Create your first site to get started."
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Resources</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
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
                      <TableCell>
                        <Badge variant="secondary">{s.driver}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {s.ram} · {s.cpu} CPU
                        {s.storage ? ` · ${s.storage}` : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {s.owner || "admin"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {timeAgo(s.created_at)}
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
