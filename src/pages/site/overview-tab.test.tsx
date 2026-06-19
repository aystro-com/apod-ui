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
        db_name: "appdb",
        db_password: "hunter2",
      },
    })
    renderWithProviders(<OverviewTab site={makeSite()} />)
    expect(await screen.findByText("7.3%")).toBeInTheDocument()
    // Safe, public field (url) renders in cleartext.
    expect(await screen.findByText("https://example.com")).toBeInTheDocument()
    // Everything not on the safe allowlist is masked by default — db_name and
    // db_password both hidden until revealed.
    expect(screen.queryByText("appdb")).not.toBeInTheDocument()
    expect(screen.queryByText("hunter2")).not.toBeInTheDocument()
    const user = userEvent.setup()
    const reveals = screen.getAllByRole("button", { name: /reveal value/i })
    for (const b of reveals) await user.click(b)
    expect(screen.getByText("appdb")).toBeInTheDocument()
    expect(screen.getByText("hunter2")).toBeInTheDocument()
  })

  it("masks a connection URL that embeds credentials", async () => {
    mockApi({
      "GET /api/v1/sites/example.com/monitor": {
        domain: "example.com",
        status: "running",
        cpu_percent: 0,
        memory_mb: 1,
        memory_limit_mb: 1,
        memory_percent: 0,
      },
      "GET /api/v1/sites/example.com/info": {
        domain: "example.com",
        driver: "laravel",
        url: "https://example.com",
        database_url: "postgres://user:s3cret@db:5432/app",
      },
    })
    renderWithProviders(<OverviewTab site={makeSite()} />)
    // The url value (no userinfo) shows; the database_url with embedded
    // credentials is masked despite the key not matching a password regex.
    expect(await screen.findByText("https://example.com")).toBeInTheDocument()
    expect(
      screen.queryByText("postgres://user:s3cret@db:5432/app"),
    ).not.toBeInTheDocument()
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
