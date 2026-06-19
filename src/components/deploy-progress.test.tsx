import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { DeployEvent } from "@/lib/api"
import { collapseSteps } from "@/lib/deploy-steps"
import { DeployProgress } from "./deploy-progress"

const ev = (over: Partial<DeployEvent>): DeployEvent => ({
  step: "Step",
  status: "running",
  percent: 0,
  run: 1,
  time: "2026-01-01T00:00:00Z",
  ...over,
})

describe("collapseSteps", () => {
  it("keeps one row per step in first-seen order, latest status wins", () => {
    const steps = collapseSteps([
      ev({ step: "Preparing", status: "running", percent: 5 }),
      ev({ step: "Preparing", status: "done", percent: 10 }),
      ev({ step: "Pulling", status: "running", detail: "sonarr Pulling", percent: 40 }),
    ])
    expect(steps.map((s) => s.step)).toEqual(["Preparing", "Pulling"])
    expect(steps[0].status).toBe("done")
    expect(steps[1].detail).toBe("sonarr Pulling")
  })
})

describe("DeployProgress", () => {
  it("renders each step and the latest detail", () => {
    render(
      <DeployProgress
        events={[
          ev({ step: "Preparing", status: "done", percent: 10 }),
          ev({ step: "Pulling images & starting containers", status: "running", detail: "Container app Started", percent: 60 }),
        ]}
      />,
    )
    expect(screen.getByText("Preparing")).toBeInTheDocument()
    // The active step shows in both the progress label and the checklist.
    expect(
      screen.getAllByText("Pulling images & starting containers").length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Container app Started")).toBeInTheDocument()
  })

  it("shows a failed state when a step errors", () => {
    render(
      <DeployProgress
        events={[
          ev({ step: "Pulling", status: "running", percent: 40 }),
          ev({ step: "Deployment failed", status: "error", percent: 100 }),
        ]}
      />,
    )
    expect(screen.getAllByText("Deployment failed").length).toBeGreaterThanOrEqual(1)
  })

  it("reflects the highest percent reached", () => {
    const { container } = render(
      <DeployProgress
        events={[ev({ percent: 20 }), ev({ percent: 85, step: "Routing" })]}
      />,
    )
    // Base UI progress exposes the value via aria-valuenow on the progress role.
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute("aria-valuenow")).toBe("85")
  })
})
