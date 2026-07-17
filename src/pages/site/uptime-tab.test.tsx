import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { UptimeTab } from "./uptime-tab"

const site = makeSite()

describe("UptimeTab", () => {
  it("offers to enable monitoring when not configured", async () => {
    const { calls } = mockApi({
      "GET /api/v1/sites/example.com/uptime": { status: 404, error: "not configured" },
      "POST /api/v1/sites/example.com/uptime": { status: 201, data: {} },
    })
    renderWithProviders(<UptimeTab site={site} />)
    const user = userEvent.setup()
    const button = await screen.findByRole("button", {
      name: /enable monitoring/i,
    })
    // URL defaults to the site's own https URL.
    expect(screen.getByLabelText(/url/i)).toHaveValue("https://example.com")
    await user.click(button)
    await waitFor(() => {
      const post = calls.find((c) => c.method === "POST")
      expect(post?.body).toEqual({
        url: "https://example.com",
        interval: 60,
        alert_webhook: "",
      })
    })
  })

  it("shows stats and recent checks when configured", async () => {
    mockApi({
      "GET /api/v1/sites/example.com/uptime": {
        check: {
          id: 1,
          site_domain: "example.com",
          url: "https://example.com",
          interval_seconds: 60,
          alert_webhook: "",
          active: true,
          created_at: "2026-01-01T00:00:00Z",
        },
        stats: {
          uptime_percent: 99.95,
          avg_response_ms: 123,
          total_checks: 1000,
          total_downtime: 0,
        },
      },
      "GET /api/v1/sites/example.com/uptime/logs": [
        {
          id: 1,
          site_domain: "example.com",
          is_up: true,
          status_code: 200,
          response_ms: 100,
          checked_at: "2026-01-01T00:00:00Z",
        },
      ],
    })
    renderWithProviders(<UptimeTab site={site} />)
    expect(await screen.findByText("99.95%")).toBeInTheDocument()
    expect(screen.getByText("123 ms")).toBeInTheDocument()
    expect(await screen.findByText("200")).toBeInTheDocument()
  })
})
