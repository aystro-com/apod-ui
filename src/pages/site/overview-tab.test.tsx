import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { OverviewTab } from "./overview-tab"

describe("OverviewTab", () => {
  it("shows live usage and masks credential-like info values", async () => {
    mockApi({
      "GET /api/v1/sites/example.com/monitor": {
        domain: "example.com",
        status: "running",
        cpu_percent: 7.3,
        memory_mb: 200,
        memory_limit_mb: 512,
        memory_percent: 39,
      },
      "GET /api/v1/sites/example.com/info": {
        domain: "example.com",
        driver: "laravel",
        url: "https://example.com",
        secrets: {
          db_name: "appdb",
          db_password: "hunter2",
        },
      },
    })
    renderWithProviders(<OverviewTab site={makeSite()} />)
    expect(await screen.findByText("7.3%")).toBeInTheDocument()
    expect(await screen.findByText("appdb")).toBeInTheDocument()
    // Password-like values are masked until revealed.
    expect(screen.queryByText("hunter2")).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /reveal value/i }))
    expect(screen.getByText("hunter2")).toBeInTheDocument()
  })

  it("does not poll the monitor when the site is stopped", async () => {
    const { calls } = mockApi({
      "GET /api/v1/sites/example.com/info": {},
    })
    renderWithProviders(<OverviewTab site={makeSite({ status: "stopped" })} />)
    expect(await screen.findByText(/not running/i)).toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith("/monitor"))).toBe(false)
  })
})
