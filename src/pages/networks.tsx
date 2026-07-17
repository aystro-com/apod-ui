import { useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { LinkIcon, NetworkIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useApi } from "@/lib/auth"
import { useAction } from "@/lib/use-action"
import type { SharedNetwork } from "@/lib/api"

export function NetworksPage() {
  const { api } = useApi()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")

  const networks = useQuery({ queryKey: ["networks"], queryFn: api.listNetworks })

  const create = useAction({
    fn: () => api.createNetwork(name.trim()),
    invalidates: [["networks"]],
    successTitle: "Network created",
    onSuccess: () => {
      setOpen(false)
      setName("")
    },
  })

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (name.trim()) create.mutate()
  }

  return (
    <>
      <PageHeader
        title="Shared networks"
        description="Connect sites' private networks on purpose — e.g. let a BI app reach an ERP's database. Sites stay isolated from everything else."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>
              <PlusIcon />
              Create network
            </DialogTrigger>
            <DialogPopup>
              <form onSubmit={handleCreate} className="contents">
                <DialogHeader>
                  <DialogTitle>Create shared network</DialogTitle>
                  <DialogDescription>
                    A private bridge that the sites you add can reach each other
                    over, by container name or IP.
                  </DialogDescription>
                </DialogHeader>
                <DialogPanel>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="net-name">Name</Label>
                    <Input
                      id="net-name"
                      placeholder="analytics"
                      autoComplete="off"
                      spellCheck={false}
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <span className="text-muted-foreground text-xs">
                      Lowercase letters, digits, _ or -.
                    </span>
                  </div>
                </DialogPanel>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!name.trim() || create.isPending}>
                    {create.isPending && <Spinner className="size-4" />}
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogPopup>
          </Dialog>
        }
      />

      {networks.isPending && <LoadingRows rows={2} />}
      {networks.isError && <ErrorState error={networks.error} />}
      {networks.data &&
        (networks.data.length === 0 ? (
          <EmptyState
            title="No shared networks"
            description="Create one, then add the sites that should be able to reach each other."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {networks.data.map((net) => (
              <NetworkCard key={net.name} net={net} />
            ))}
          </div>
        ))}
    </>
  )
}

function NetworkCard({ net }: { net: SharedNetwork }) {
  const { api } = useApi()
  const [toAdd, setToAdd] = useState("")

  const members = net.members ?? []
  const sites = useQuery({ queryKey: ["sites"], queryFn: api.listSites })
  const candidates = (sites.data ?? [])
    .map((s) => s.domain)
    .filter((d) => !members.includes(d))

  const addMember = useAction({
    fn: () => api.addNetworkMember(net.name, toAdd),
    invalidates: [["networks"]],
    successTitle: "Site added",
    onSuccess: () => setToAdd(""),
  })
  const removeMember = useAction({
    fn: (domain: string) => api.removeNetworkMember(net.name, domain),
    invalidates: [["networks"]],
    successTitle: "Site removed",
  })
  const remove = useAction({
    fn: () => api.deleteNetwork(net.name),
    invalidates: [["networks"]],
    successTitle: "Network deleted",
  })

  return (
    <Card className="max-w-3xl">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <NetworkIcon className="size-4 text-sky-600" />
            {net.name}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              apod-net-{net.name}
            </code>
          </CardTitle>
          <CardDescription>
            {members.length} site{members.length === 1 ? "" : "s"} ·
            owner {net.owner || "admin"}
          </CardDescription>
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${net.name}`}>
              <Trash2Icon />
            </Button>
          }
          title={`Delete ${net.name}`}
          description="Member sites are disconnected from this network. Their own private networks and data are untouched."
          confirmLabel="Delete"
          onConfirm={() => remove.mutateAsync(undefined)}
        />
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        {members.length === 0 ? (
          <p className="text-muted-foreground text-sm">No sites in this network yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <Badge key={m} variant="secondary" className="gap-1.5 py-1 pr-1">
                <LinkIcon className="size-3" />
                {m}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-4"
                  aria-label={`Remove ${m}`}
                  onClick={() => removeMember.mutate(m)}
                >
                  <XIcon className="size-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Select value={toAdd} onValueChange={(v) => setToAdd(v as string)}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Add a site…">{toAdd}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {candidates.length === 0 ? (
                <SelectItem value="" disabled>
                  {sites.isError
                    ? "Couldn't load sites"
                    : sites.isPending
                      ? "Loading sites…"
                      : "No more sites"}
                </SelectItem>
              ) : (
                candidates.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))
              )}
            </SelectPopup>
          </Select>
          <Button
            variant="outline"
            disabled={!toAdd || addMember.isPending}
            onClick={() => addMember.mutate(undefined)}
          >
            {addMember.isPending ? <Spinner className="size-4" /> : <PlusIcon />}
            Add site
          </Button>
        </div>
      </CardPanel>
    </Card>
  )
}
