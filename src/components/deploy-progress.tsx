import { CheckIcon, CircleAlertIcon } from "lucide-react"
import type { DeployEvent } from "@/lib/api"
import {
  Progress,
  ProgressLabel,
  ProgressTrack,
  ProgressIndicator,
  ProgressValue,
} from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { collapseSteps } from "@/lib/deploy-steps"
import { cn } from "@/lib/utils"

export function DeployProgress({ events }: { events: DeployEvent[] }) {
  const steps = collapseSteps(events)
  const last = events[events.length - 1]
  const percent = events.reduce((m, e) => Math.max(m, e.percent), 0)
  const failed = steps.some((s) => s.status === "error")

  return (
    <div className="flex flex-col gap-4" data-slot="deploy-progress">
      <Progress value={failed ? null : percent}>
        <div className="flex items-center justify-between">
          <ProgressLabel>
            {failed ? "Deployment failed" : last?.step ?? "Starting…"}
          </ProgressLabel>
          <ProgressValue />
        </div>
        <ProgressTrack>
          <ProgressIndicator className={cn(failed && "bg-destructive")} />
        </ProgressTrack>
      </Progress>

      <ol className="flex flex-col gap-2.5">
        {steps.map((s) => (
          <li key={s.step} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
              {s.status === "done" ? (
                <CheckIcon className="size-4 text-success" />
              ) : s.status === "error" ? (
                <CircleAlertIcon className="size-4 text-destructive-foreground" />
              ) : (
                <Spinner className="size-3.5 text-muted-foreground" />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  s.status === "running" && "text-foreground",
                  s.status !== "running" && "text-muted-foreground",
                )}
              >
                {s.step}
              </span>
              {s.detail && (
                <span className="truncate font-mono text-muted-foreground text-xs">
                  {s.detail}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
