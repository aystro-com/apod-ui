import { useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { DatabaseIcon, PlusIcon, Trash2Icon } from "lucide-react"
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
import { timeAgo } from "@/lib/format"

// Config fields per storage driver, mirroring `apod storage add` flags.
const DRIVER_FIELDS: Record<
  string,
  Array<{ key: string; label: string; secret?: boolean }>
> = {
  s3: [
    { key: "bucket", label: "Bucket" },
    { key: "region", label: "Region" },
    { key: "access_key", label: "Access key" },
    { key: "secret_key", label: "Secret key", secret: true },
  ],
  r2: [
    { key: "bucket", label: "Bucket" },
    { key: "account_id", label: "Account ID" },
    { key: "access_key", label: "Access key" },
    { key: "secret_key", label: "Secret key", secret: true },
  ],
  sftp: [
    { key: "host", label: "Host" },
    { key: "user", label: "User" },
    { key: "password", label: "Password", secret: true },
    { key: "path", label: "Remote path" },
  ],
}

export function StoragePage() {
  const { api } = useApi()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [driver, setDriver] = useState("s3")
  const [config, setConfig] = useState<Record<string, string>>({})

  const storages = useQuery({ queryKey: ["storage"], queryFn: api.listStorage })

  const add = useAction({
    fn: () => {
      const fields = DRIVER_FIELDS[driver] ?? []
      const cfg: Record<string, string> = {}
      for (const f of fields) cfg[f.key] = (config[f.key] ?? "").trim()
      return api.addStorage(name.trim(), driver, cfg)
    },
    invalidates: [["storage"]],
    successTitle: "Storage added",
    onSuccess: () => {
      setOpen(false)
      setName("")
      setConfig({})
    },
  })
  const remove = useAction({
    fn: (n: string) => api.removeStorage(n),
    invalidates: [["storage"]],
    successTitle: "Storage removed",
  })

  function handleSave(e: FormEvent) {
    e.preventDefault()
    if (name.trim()) add.mutate()
  }

  const fields = DRIVER_FIELDS[driver] ?? []

  return (
    <>
      <PageHeader
        title="Backup storage"
        description="Remote destinations for backups. Local disk is always available as the default."
        actions={
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o)
              // Clear entered credentials when the dialog closes (Cancel/overlay),
              // not only on success, so secrets don't linger in client state.
              if (!o) {
                setConfig({})
                setName("")
              }
            }}
          >
            <DialogTrigger render={<Button />}>
              <PlusIcon />
              Add storage
            </DialogTrigger>
            <DialogPopup>
              <form onSubmit={handleSave} className="contents">
                <DialogHeader>
                  <DialogTitle>Add backup storage</DialogTitle>
                  <DialogDescription>
                    Credentials are stored on the apod server and used only for
                    backup uploads.
                  </DialogDescription>
                </DialogHeader>
                <DialogPanel className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="storage-name">Name</Label>
                      <Input
                        id="storage-name"
                        placeholder="my-s3"
                        autoComplete="off"
                        spellCheck={false}
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="storage-driver">Driver</Label>
                      <Select
                        value={driver}
                        onValueChange={(v) => {
                          setDriver(v as string)
                          setConfig({})
                        }}
                      >
                        <SelectTrigger id="storage-driver" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectPopup>
                          <SelectItem value="s3">S3 (or compatible)</SelectItem>
                          <SelectItem value="r2">Cloudflare R2</SelectItem>
                          <SelectItem value="sftp">SFTP</SelectItem>
                        </SelectPopup>
                      </Select>
                    </div>
                    {fields.map((f) => (
                      <div key={f.key} className="flex flex-col gap-2">
                        <Label htmlFor={`storage-${f.key}`}>{f.label}</Label>
                        <Input
                          id={`storage-${f.key}`}
                          type={f.secret ? "password" : "text"}
                          autoComplete="off"
                          spellCheck={false}
                          value={config[f.key] ?? ""}
                          onChange={(e) =>
                            setConfig((c) => ({ ...c, [f.key]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </DialogPanel>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOpen(false)
                      setConfig({})
                      setName("")
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!name.trim() || add.isPending}>
                    {add.isPending && <Spinner className="size-4" />}
                    Save
                  </Button>
                </DialogFooter>
              </form>
            </DialogPopup>
          </Dialog>
        }
      />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Configured backends</CardTitle>
          <CardDescription>
            Use these by name when creating backups or schedules.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          {storages.isPending && <LoadingRows rows={2} />}
          {storages.isError && <ErrorState error={storages.error} />}
          {storages.data &&
            (storages.data.length === 0 ? (
              <EmptyState
                title="No remote storage"
                description="Backups go to local disk until you add S3, R2, or SFTP storage."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storages.data.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell>
                        <span className="flex items-center gap-2 font-medium">
                          <DatabaseIcon className="size-4 text-muted-foreground" />
                          {s.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.driver}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {timeAgo(s.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${s.name}`}
                            >
                              <Trash2Icon />
                            </Button>
                          }
                          title={`Remove ${s.name}`}
                          description="Schedules pointing at this storage will fail until reconfigured. Existing backups in the bucket are not deleted."
                          confirmLabel="Remove"
                          onConfirm={() => remove.mutateAsync(s.name)}
                        />
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
