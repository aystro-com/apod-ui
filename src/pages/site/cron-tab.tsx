import { useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { ClockIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState, ErrorState, LoadingRows } from "@/components/data-state"
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

export function CronTab({ site }: { site: Site }) {
  const { api } = useApi()
  const [schedule, setSchedule] = useState("")
  const [command, setCommand] = useState("")
  const [service, setService] = useState("")

  const jobs = useQuery({
    queryKey: ["cron", site.domain],
    queryFn: () => api.listCron(site.domain),
  })

  const add = useAction({
    fn: () =>
      api.addCron(site.domain, schedule.trim(), command.trim(), service.trim() || undefined),
    invalidates: [["cron", site.domain]],
    successTitle: "Cron job added",
    onSuccess: () => {
      setSchedule("")
      setCommand("")
      setService("")
    },
  })
  const remove = useAction({
    fn: (id: number) => api.removeCron(site.domain, id),
    invalidates: [["cron", site.domain]],
    successTitle: "Cron job removed",
  })

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (schedule.trim() && command.trim()) add.mutate()
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Cron jobs</CardTitle>
        <CardDescription>
          Jobs run inside the site's container on a standard 5-field cron
          schedule (e.g.{" "}
          <code className="font-mono text-xs">*/5 * * * *</code>).
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <form className="flex flex-wrap items-center gap-2" onSubmit={handleAdd}>
          <Input
            placeholder="*/5 * * * *"
            autoComplete="off"
            spellCheck={false}
            className="w-36 font-mono"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
          />
          <Input
            placeholder="php artisan schedule:run"
            autoComplete="off"
            spellCheck={false}
            className="w-72 font-mono"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
          />
          <Input
            placeholder="app"
            autoComplete="off"
            spellCheck={false}
            className="w-24 font-mono"
            value={service}
            onChange={(e) => setService(e.target.value)}
          />
          <Button
            type="submit"
            disabled={!schedule.trim() || !command.trim() || add.isPending}
          >
            {add.isPending ? <Spinner className="size-4" /> : <PlusIcon />}
            Add job
          </Button>
        </form>

        {jobs.isPending && <LoadingRows rows={2} />}
        {jobs.isError && <ErrorState error={jobs.error} />}
        {jobs.data &&
          (jobs.data.length === 0 ? (
            <EmptyState
              title="No cron jobs"
              description="Add a job above. Drivers may also define default jobs at site creation."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Command</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.data.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <ClockIcon className="size-4 text-muted-foreground" />
                        <code className="font-mono text-sm">{j.schedule}</code>
                      </span>
                    </TableCell>
                    <TableCell>
                      <code className="block max-w-72 truncate font-mono text-sm">
                        {j.command}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm">{j.service || "app"}</TableCell>
                    <TableCell className="text-right">
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove cron job #${j.id}`}
                          >
                            <Trash2Icon />
                          </Button>
                        }
                        title="Remove cron job"
                        description={
                          <>
                            <code className="font-mono text-xs">{j.command}</code>{" "}
                            will no longer run on schedule.
                          </>
                        }
                        confirmLabel="Remove"
                        onConfirm={() => remove.mutateAsync(j.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}
      </CardPanel>
    </Card>
  )
}
