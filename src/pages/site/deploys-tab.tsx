import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { GitBranchIcon, RocketIcon, UndoIcon, WebhookIcon } from "lucide-react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { CopyButton } from "@/components/copy-button"
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
import { formatDate, shortHash } from "@/lib/format"
import type { Site } from "@/lib/api"

export function DeploysTab({ site }: { site: Site }) {
  const { api, session } = useApi()
  const [branch, setBranch] = useState("")

  const deployments = useQuery({
    queryKey: ["deployments", site.domain],
    queryFn: () => api.listDeployments(site.domain),
  })
  const webhooks = useQuery({
    queryKey: ["webhooks", site.domain],
    queryFn: () => api.listWebhooks(site.domain),
  })

  const deploy = useAction({
    fn: () => api.deploy(site.domain, branch.trim() || undefined),
    invalidates: [["deployments", site.domain], ["site", site.domain]],
    successTitle: "Deploy finished",
  })
  const rollback = useAction({
    fn: () => api.rollback(site.domain),
    invalidates: [["deployments", site.domain], ["site", site.domain]],
    successTitle: "Rolled back",
  })
  const createWebhook = useAction({
    fn: () => api.createWebhook(site.domain),
    invalidates: [["webhooks", site.domain]],
    successTitle: "Webhook created",
  })
  const deleteWebhook = useAction({
    fn: () => api.deleteWebhook(site.domain),
    invalidates: [["webhooks", site.domain]],
    successTitle: "Webhook deleted",
  })

  const hasRepo = Boolean(site.repo)
  const webhookBase = session.baseUrl || window.location.origin

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Deploy</CardTitle>
          <CardDescription>
            {hasRepo ? (
              <>
                Pulls <code className="font-mono text-xs">{site.repo}</code>,
                runs deploy hooks, and restarts the site. A backup is created
                automatically before every deploy.
              </>
            ) : (
              "No git repository is configured for this site. Set one in Settings to enable deploys."
            )}
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-wrap items-center gap-2">
          <span className="relative">
            <GitBranchIcon className="-translate-y-1/2 absolute start-2.5 top-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={site.branch || "default branch"}
              autoComplete="off"
              spellCheck={false}
              className="w-56 ps-8"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={!hasRepo}
            />
          </span>
          <Button
            disabled={!hasRepo || deploy.isPending}
            onClick={() => deploy.mutate()}
          >
            {deploy.isPending ? <Spinner className="size-4" /> : <RocketIcon />}
            {deploy.isPending ? "Deploying…" : "Deploy now"}
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="outline" disabled={!hasRepo || rollback.isPending}>
                <UndoIcon />
                Rollback
              </Button>
            }
            title="Roll back deployment"
            description="The site will be reverted to the previous deploy. The current code state will be replaced."
            confirmLabel="Roll back"
            onConfirm={() => rollback.mutateAsync()}
          />
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Push-to-deploy webhook</CardTitle>
          <CardDescription>
            Add this URL to your GitHub/GitLab webhook settings — any push
            triggers a deploy. Treat the URL as a secret.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-3">
          {webhooks.isPending && <LoadingRows rows={1} />}
          {webhooks.isError && <ErrorState error={webhooks.error} />}
          {webhooks.data && webhooks.data.length === 0 && (
            <Button
              variant="outline"
              className="self-start"
              disabled={createWebhook.isPending}
              onClick={() => createWebhook.mutate()}
            >
              {createWebhook.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <WebhookIcon />
              )}
              Create webhook
            </Button>
          )}
          {(webhooks.data ?? []).map((wh) => {
            const url = `${webhookBase}/webhook/${wh.token}`
            return (
              <div
                key={wh.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2"
              >
                <code className="truncate font-mono text-sm">{url}</code>
                <span className="flex shrink-0 items-center gap-1">
                  <CopyButton value={url} label="Copy webhook URL" />
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm">
                        Delete
                      </Button>
                    }
                    title="Delete webhook"
                    description="Pushes to your repository will no longer trigger deploys. The URL stops working immediately."
                    confirmLabel="Delete"
                    onConfirm={() => deleteWebhook.mutateAsync()}
                  />
                </span>
              </div>
            )
          })}
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployment history</CardTitle>
        </CardHeader>
        <CardPanel>
          {deployments.isPending && <LoadingRows rows={3} />}
          {deployments.isError && <ErrorState error={deployments.error} />}
          {deployments.data &&
            (deployments.data.length === 0 ? (
              <EmptyState
                title="No deployments yet"
                description="Trigger a deploy to see its history here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commit</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployments.data.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <code className="font-mono text-sm">
                          {shortHash(d.commit_hash)}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm">{d.branch || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(d.created_at)}
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
