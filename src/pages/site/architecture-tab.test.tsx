import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { ArchitectureTab } from "./architecture-tab"

const site = makeSite()

function setup(extra: Record<string, unknown> = {}) {
  return mockApi({
    "GET /api/v1/sites/example.com/processes": [
      { service: "app", role: "web", image: "img", command: "", replicas: 1, running: 1, scalable: false, containers: [{ name: "apod-example.com-app", ip: "172.20.0.2" }] },
      { service: "queue", role: "worker", image: "img", command: "queue:work", replicas: 2, running: 2, scalable: true, containers: [{ name: "apod-example.com-queue-0", ip: "172.20.0.3" }, { name: "apod-example.com-queue-1", ip: "172.20.0.4" }] },
      { service: "scheduler", role: "scheduler", image: "img", command: "schedule:work", replicas: 1, running: 1, scalable: false, containers: [{ name: "apod-example.com-scheduler", ip: "172.20.0.5" }] },
      { service: "db", role: "", image: "mysql", command: "", replicas: 1, running: 1, scalable: false, containers: [{ name: "apod-example.com-db", ip: "172.20.0.6" }] },
    ],
    ...extra,
  })
}

describe("ArchitectureTab", () => {
  it("renders web, worker, scheduler, and service nodes", async () => {
    setup()
    renderWithProviders(<ArchitectureTab site={site} />)
    expect(await screen.findByText("app")).toBeInTheDocument()
    expect(screen.getByText("queue")).toBeInTheDocument()
    expect(screen.getByText("scheduler")).toBeInTheDocument()
    expect(screen.getByText("db")).toBeInTheDocument()
    // Worker shows running/desired counts.
    expect(screen.getByText("2/2 up")).toBeInTheDocument()
  })

  it("shows container private IPs", async () => {
    setup()
    renderWithProviders(<ArchitectureTab site={site} />)
    expect(await screen.findByText("172.20.0.2")).toBeInTheDocument()
    expect(screen.getByText("172.20.0.6")).toBeInTheDocument()
  })

  it("renders shared-network neighbors when the site is linked", async () => {
    setup({
      "GET /api/v1/sites/example.com/network": [
        {
          network: "analytics",
          site: "erp.example.com",
          service: "db",
          name: "apod-erp.example.com-db",
          ip: "172.30.0.4",
          running: true,
        },
      ],
    })
    renderWithProviders(<ArchitectureTab site={site} />)
    expect(await screen.findByText("Shared networks")).toBeInTheDocument()
    expect(screen.getByText("analytics")).toBeInTheDocument()
    expect(screen.getByText("erp.example.com")).toBeInTheDocument()
    expect(screen.getByText("172.30.0.4")).toBeInTheDocument()
  })

  it("frames the site as one isolated unit", async () => {
    setup()
    renderWithProviders(<ArchitectureTab site={site} />)
    expect(await screen.findByText("apod-site-example-com")).toBeInTheDocument()
    expect(screen.getByText(/no other site can reach them/i)).toBeInTheDocument()
  })

  it("scales a worker up", async () => {
    const { calls } = setup({
      "POST /api/v1/sites/example.com/processes/queue/scale": { status: "scaled" },
    })
    renderWithProviders(<ArchitectureTab site={site} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /scale queue up/i }))
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.path === "/api/v1/sites/example.com/processes/queue/scale" &&
            JSON.stringify(c.body) === JSON.stringify({ replicas: 3 }),
        ),
      ).toBe(true)
    })
  })

  it("does not offer scaling controls for non-worker processes", async () => {
    setup()
    renderWithProviders(<ArchitectureTab site={site} />)
    await screen.findByText("app")
    // Only the worker (queue) exposes scale-up/down controls.
    expect(screen.queryByRole("button", { name: /scale app up/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /scale db up/i })).toBeNull()
  })
})
