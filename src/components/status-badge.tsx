import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  running: "bg-success/12 text-success border-success/24",
  up: "bg-success/12 text-success border-success/24",
  success: "bg-success/12 text-success border-success/24",
  completed: "bg-success/12 text-success border-success/24",
  stopped: "bg-muted text-muted-foreground",
  down: "bg-destructive/12 text-destructive-foreground border-destructive/24",
  failed: "bg-destructive/12 text-destructive-foreground border-destructive/24",
  error: "bg-destructive/12 text-destructive-foreground border-destructive/24",
  pending: "bg-warning/12 text-warning border-warning/24",
  deploying: "bg-info/12 text-info border-info/24",
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "unknown").toLowerCase()
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", STATUS_STYLES[normalized])}
    >
      <span
        className={cn(
          "me-0.5 inline-block size-1.5 rounded-full bg-current",
          (normalized === "running" || normalized === "up") && "animate-pulse",
        )}
      />
      {normalized}
    </Badge>
  )
}
