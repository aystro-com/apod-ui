import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { mockApi, renderWithProviders } from "@/test/utils"
import { DashboardPage } from "./dashboard"

const stats = {
  cpu_count: 8,
  mem_total_mb: 16384,
  mem_used_mb: 8192,
  mem_percent: 50,
  disk_total_gb: 100,
  disk_used_gb: 25,
  disk_percent: 25,
  site_count: 3,
}

const monitor = [
  {
    domain: "example.com",
    status: "running",
    cpu_percent: 12.5,
    memory_mb: 256,
    memory_limit_mb: 512,
    memory_percent: 50,
  },
]

describe("DashboardPage", () => {
  it("shows server stats and per-site usage for admins", async () => {
    mockApi({
      "GET /api/v1/server-stats": stats,
      "GET /api/v1/monitor": monitor,
    })
    renderWithProviders(<DashboardPage />, { role: "admin" })
    expect(await screen.findByText("8 cores")).toBeInTheDocument()
    expect(await screen.findByText("example.com")).toBeInTheDocument()
    expect(screen.getByText("12.5%")).toBeInTheDocument()
  })

  it("skips server stats for non-admin users", async () => {
    const { calls } = mockApi({ "GET /api/v1/monitor": monitor })
    renderWithProviders(<DashboardPage />, { role: "user" })
    expect(await screen.findByText("example.com")).toBeInTheDocument()
    expect(calls.some((c) => c.path === "/api/v1/server-stats")).toBe(false)
  })

  it("shows an empty state when there are no sites", async () => {
    mockApi({
      "GET /api/v1/server-stats": stats,
      "GET /api/v1/monitor": [],
    })
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText(/no sites yet/i)).toBeInTheDocument()
  })
})
