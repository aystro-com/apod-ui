import { useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { GlobeIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import type { Site } from "@/lib/api"

export function DomainsTab({ site }: { site: Site }) {
  const { api } = useApi()
  const [alias, setAlias] = useState("")

  const domains = useQuery({
    queryKey: ["domains", site.domain],
    queryFn: () => api.listDomains(site.domain),
  })

  const add = useAction({
    fn: (a: string) => api.addDomain(site.domain, a),
    invalidates: [["domains", site.domain]],
    successTitle: "Domain added",
    onSuccess: () => setAlias(""),
  })
  const remove = useAction({
    fn: (a: string) => api.removeDomain(site.domain, a),
    invalidates: [["domains", site.domain]],
    successTitle: "Domain removed",
  })

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    const a = alias.trim().toLowerCase()
    if (a) add.mutate(a)
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Domains</CardTitle>
        <CardDescription>
          Aliases that route to this site. Every domain gets automatic SSL via
          Let's Encrypt — point DNS here first.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <form className="flex gap-2" onSubmit={handleAdd}>
          <Input
            placeholder="alias.example.com"
            autoComplete="off"
            spellCheck={false}
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={!alias.trim() || add.isPending}>
            {add.isPending ? <Spinner className="size-4" /> : <PlusIcon />}
            Add domain
          </Button>
        </form>

        {domains.isPending && <LoadingRows rows={2} />}
        {domains.isError && <ErrorState error={domains.error} />}
        {domains.data &&
          (domains.data.length === 0 ? (
            <EmptyState
              title="No domains"
              description="Add an alias domain to route it to this site."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.data.map((d) => {
                  const isPrimary = d === site.domain
                  return (
                    <TableRow key={d}>
                      <TableCell>
                        <span className="flex items-center gap-2 font-medium">
                          <GlobeIcon className="size-4 text-muted-foreground" />
                          {d}
                          {isPrimary && <Badge variant="secondary">primary</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {!isPrimary && (
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Remove ${d}`}
                              >
                                <Trash2Icon />
                              </Button>
                            }
                            title="Remove domain"
                            description={`${d} will stop routing to this site and its SSL certificate will no longer be renewed.`}
                            confirmLabel="Remove"
                            onConfirm={() => remove.mutateAsync(d)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ))}
      </CardPanel>
    </Card>
  )
}
