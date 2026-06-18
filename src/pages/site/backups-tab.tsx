import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArchiveIcon,
  CalendarClockIcon,
  CopyPlusIcon,
  PlusIcon,
  Trash2Icon,
  UndoIcon,
} from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-state"
import { StatusBadge } from "@/components/status-badge"
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
  DialogClose,
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
import { formatBytes, formatDate } from "@/lib/format"
import type { Site } from "@/lib/api"

const INTERVALS = ["hourly", "daily", "weekly", "monthly"]
const KEEP_OPTIONS = ["3", "7", "14", "30"]

export function BackupsTab({ site }: { site: Site }) {
  const { api } = useApi()
  const [backupStorage, setBackupStorage] = useState("")
  const [every, setEvery] = useState("daily")
  const [keep, setKeep] = useState("7")
  const [scheduleStorage, setScheduleStorage] = useState("")

  const backups = useQuery({
    queryKey: ["backups", site.domain],
    queryFn: () => api.listBackups(site.domain),
  })
  const schedules = useQuery({
    queryKey: ["backup-schedules", site.domain],
    queryFn: () => api.listBackupSchedules(site.domain),
  })
  const storages = useQuery({ queryKey: ["storage"], queryFn: api.listStorage })

  const create = useAction({
    fn: () => api.createBackup(site.domain, backupStorage || undefined),
    invalidates: [["backups", site.domain]],
    successTitle: "Backup created",
  })
  const restore = useAction({
    fn: (id: number) => api.restoreBackup(site.domain, id),
    invalidates: [["backups", site.domain], ["site", site.domain]],
    successTitle: "Backup restored",
  })
  const remove = useAction({
    fn: (id: number) => api.deleteBackup(site.domain, id),
    invalidates: [["backups", site.domain]],
    successTitle: "Backup deleted",
  })
  const addSchedule = useAction({
    fn: () =>
      api.addBackupSchedule(
        site.domain,
        every,
        Number(keep),
        scheduleStorage || undefined,
      ),
    invalidates: [["backup-schedules", site.domain]],
    successTitle: "Schedule added",
  })
  const removeSchedule = useAction({
    fn: (id: number) => api.removeBackupSchedule(site.domain, id),
    invalidates: [["backup-schedules", site.domain]],
    successTitle: "Schedule removed",
  })

  const storageNames = ["", ...(storages.data ?? []).map((s) => s.name)]
  const storageLabel = (v: string) => (v ? v : "local (default)")

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Backups</CardTitle>
          <CardDescription>
            Each backup includes database dumps, site files, volume data, and
            metadata. Backups are verified after creation.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={backupStorage}
              onValueChange={(v) => setBackupStorage(v as string)}
            >
              <SelectTrigger className="w-48">
                <SelectValue>{storageLabel}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {storageNames.map((n) => (
                  <SelectItem key={n || "local"} value={n}>
                    {storageLabel(n)}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? <Spinner className="size-4" /> : <ArchiveIcon />}
              {create.isPending ? "Backing up…" : "Back up now"}
            </Button>
          </div>

          {backups.isPending && <LoadingRows rows={3} />}
          {backups.isError && <ErrorState error={backups.error} />}
          {backups.data &&
            (backups.data.length === 0 ? (
              <EmptyState
                title="No backups yet"
                description="Create a backup now or add a schedule below."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.data.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="tabular-nums">#{b.id}</TableCell>
                      <TableCell className="text-sm">
                        {b.storage_name || "local"}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {formatBytes(b.size_bytes)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(b.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex justify-end gap-1">
                          <NewSiteFromBackupDialog
                            sourceDomain={site.domain}
                            backupId={b.id}
                          />
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Restore backup #${b.id}`}
                              >
                                <UndoIcon />
                              </Button>
                            }
                            title={`Restore backup #${b.id}`}
                            description="The site's current files and databases will be replaced with the contents of this backup. This cannot be undone."
                            confirmLabel="Restore"
                            onConfirm={() => restore.mutateAsync(b.id)}
                          />
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Delete backup #${b.id}`}
                              >
                                <Trash2Icon />
                              </Button>
                            }
                            title={`Delete backup #${b.id}`}
                            description="The backup archive will be permanently deleted from storage."
                            confirmLabel="Delete"
                            onConfirm={() => remove.mutateAsync(b.id)}
                          />
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled backups</CardTitle>
          <CardDescription>
            Automatic backups with retention. Old backups beyond the keep count
            are deleted.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={every} onValueChange={(v) => setEvery(v as string)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {INTERVALS.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <Select value={keep} onValueChange={(v) => setKeep(v as string)}>
              <SelectTrigger className="w-32">
                <SelectValue>{(v: string) => `keep ${v}`}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {KEEP_OPTIONS.map((k) => (
                  <SelectItem key={k} value={k}>
                    keep {k}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <Select
              value={scheduleStorage}
              onValueChange={(v) => setScheduleStorage(v as string)}
            >
              <SelectTrigger className="w-44">
                <SelectValue>{storageLabel}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {storageNames.map((n) => (
                  <SelectItem key={n || "local"} value={n}>
                    {storageLabel(n)}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <Button
              variant="outline"
              disabled={addSchedule.isPending}
              onClick={() => addSchedule.mutate()}
            >
              {addSchedule.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <PlusIcon />
              )}
              Add schedule
            </Button>
          </div>

          {schedules.isPending && <LoadingRows rows={1} />}
          {schedules.data &&
            (schedules.data.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No schedules configured.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Keep</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.data.map((sch) => (
                    <TableRow key={sch.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <CalendarClockIcon className="size-4 text-muted-foreground" />
                          <code className="font-mono text-sm">{sch.cron_expr}</code>
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">{sch.keep_count}</TableCell>
                      <TableCell className="text-sm">
                        {sch.storage_name || "local"}
                      </TableCell>
                      <TableCell className="text-right">
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove schedule #${sch.id}`}
                            >
                              <Trash2Icon />
                            </Button>
                          }
                          title="Remove schedule"
                          description="Automatic backups on this schedule will stop. Existing backups are kept."
                          confirmLabel="Remove"
                          onConfirm={() => removeSchedule.mutateAsync(sch.id)}
                        />
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

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i

/** Provisions a brand-new site from a backup, leaving the source untouched. */
function NewSiteFromBackupDialog({
  sourceDomain,
  backupId,
}: {
  sourceDomain: string
  backupId: number
}) {
  const { api } = useApi()
  const [open, setOpen] = useState(false)
  const [newDomain, setNewDomain] = useState("")
  const [error, setError] = useState<string | null>(null)

  const create = useAction({
    fn: () => api.newSiteFromBackup(sourceDomain, backupId, newDomain.trim()),
    invalidates: [["sites"]],
    successTitle: "Site created from backup",
    onSuccess: () => {
      setOpen(false)
      setNewDomain("")
      setError(null)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const d = newDomain.trim()
    if (!DOMAIN_RE.test(d)) {
      setError("Enter a valid domain, e.g. staging.example.com.")
      return
    }
    if (d === sourceDomain) {
      setError("The new domain must differ from the source site.")
      return
    }
    create.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Create a new site from backup #${backupId}`}
          />
        }
      >
        <CopyPlusIcon />
      </DialogTrigger>
      <DialogPopup>
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>New site from backup #{backupId}</DialogTitle>
            <DialogDescription>
              Provisions a new site with this backup's files, databases, and
              volumes. {sourceDomain} is left untouched — ideal for spinning up
              staging from production.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-2">
            <Label htmlFor="new-site-domain">New domain</Label>
            <Input
              id="new-site-domain"
              placeholder="staging.example.com"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
            />
            {error && (
              <p className="text-destructive-foreground text-xs">{error}</p>
            )}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!newDomain.trim() || create.isPending}>
              {create.isPending ? <Spinner className="size-4" /> : <CopyPlusIcon />}
              Create site
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}
