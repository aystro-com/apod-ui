import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { SiteDetailPage } from "./site-detail"

function setup(siteOverrides: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const site = makeSite(siteOverrides)
  return mockApi({
    "GET /api/v1/sites/example.com": site,
    "GET /api/v1/sites/example.com/monitor": {
      domain: "example.com",
      status: site.status,
      cpu_percent: 1,
      memory_mb: 100,
      memory_limit_mb: 512,
      memory_percent: 20,
    },
    "GET /api/v1/sites/example.com/info": { db_name: "appdb" },
    ...extra,
  })
}

function renderDetail() {
  return renderWithProviders(<SiteDetailPage />, {
    route: "/sites/example.com",
    path: ["/sites/$domain", "/sites/$domain/$"],
  })
}

describe("SiteDetailPage", () => {
  it("shows the site header with status and driver", async () => {
    setup()
    renderDetail()
    expect(
      await screen.findByRole("heading", { name: /example\.com/ }),
    ).toBeInTheDocument()
    expect(screen.getByText("running")).toBeInTheDocument()
    expect(screen.getByText("php")).toBeInTheDocument()
  })

  it("offers stop/restart for a running site", async () => {
    const { calls } = setup({}, {
      "POST /api/v1/sites/example.com/restart": { status: "restarted" },
    })
    renderDetail()
    const user = userEvent.setup()
    expect(
      screen.queryByRole("button", { name: /^start$/i }),
    ).not.toBeInTheDocument()
    await user.click(await screen.findByRole("button", { name: /restart/i }))
    await waitFor(() => {
      expect(
        calls.some((c) => c.path === "/api/v1/sites/example.com/restart"),
      ).toBe(true)
    })
  })

  it("offers start for a stopped site", async () => {
    const { calls } = setup(
      { status: "stopped" },
      { "POST /api/v1/sites/example.com/start": { status: "started" } },
    )
    renderDetail()
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /^start$/i }))
    await waitFor(() => {
      expect(
        calls.some((c) => c.path === "/api/v1/sites/example.com/start"),
      ).toBe(true)
    })
  })

  it("shows a live busy banner while an operation holds the lock", async () => {
    setup(
      {},
      {
        "GET /api/v1/sites/example.com/activity": {
          operation: "deploying",
          since: new Date().toISOString(),
          held: true,
        },
      },
    )
    renderDetail()
    expect(await screen.findByText(/deploying/i)).toBeInTheDocument()
    expect(screen.getByText(/this site is busy/i)).toBeInTheDocument()
  })

  it("hides the busy banner when the site is idle", async () => {
    setup(
      {},
      {
        "GET /api/v1/sites/example.com/activity": {
          operation: "",
          since: "0001-01-01T00:00:00Z",
          held: false,
        },
      },
    )
    renderDetail()
    await screen.findByRole("heading", { name: /example\.com/ })
    expect(screen.queryByText(/this site is busy/i)).not.toBeInTheDocument()
  })

  it("shows an error state for a missing site", async () => {
    mockApi({
      "GET /api/v1/sites/example.com": { status: 404, error: "site not found" },
    })
    renderDetail()
    expect(await screen.findByText(/site not found/)).toBeInTheDocument()
  })
})
