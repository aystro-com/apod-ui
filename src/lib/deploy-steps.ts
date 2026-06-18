import type { DeployEvent } from "@/lib/api"

export interface StepState {
  step: string
  status: DeployEvent["status"]
  detail?: string
}

// collapseSteps reduces the raw event stream to one row per step (latest status
// wins), preserving first-seen order — so the UI shows a clean checklist rather
// than every individual line.
export function collapseSteps(events: DeployEvent[]): StepState[] {
  const order: string[] = []
  const byStep = new Map<string, StepState>()
  for (const ev of events) {
    if (!byStep.has(ev.step)) order.push(ev.step)
    byStep.set(ev.step, {
      step: ev.step,
      status: ev.status,
      detail: ev.detail || byStep.get(ev.step)?.detail,
    })
  }
  return order.map((s) => byStep.get(s)!)
}
