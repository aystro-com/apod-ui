import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { CronTab } from "./cron-tab"

const site = makeSite()

describe("CronTab", () => {
  it("lists cron jobs", async () => {
    mockApi({
      "GET /api/v1/sites/example.com/cron": [
        {
          id: 1,
          site_domain: "example.com",
          schedule: "*/5 * * * *",
          command: "php artisan schedule:run",
          service: "app",
          active: true,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    })
    renderWithProviders(<CronTab site={site} />)
    expect(
      await screen.findByText("php artisan schedule:run"),
    ).toBeInTheDocument()
    // Appears both in the description example and the table row.
    expect(screen.getAllByText("*/5 * * * *").length).toBeGreaterThanOrEqual(2)
  })

  it("adds a job with schedule, command, and default service", async () => {
    const { calls } = mockApi({
      "GET /api/v1/sites/example.com/cron": [],
      "POST /api/v1/sites/example.com/cron": { status: "added" },
    })
    renderWithProviders(<CronTab site={site} />)
    const user = userEvent.setup()
    await user.type(
      await screen.findByPlaceholderText("*/5 * * * *"),
      "0 3 * * *",
    )
    await user.type(
      screen.getByPlaceholderText(/artisan/i),
      "node cleanup.js",
    )
    await user.click(screen.getByRole("button", { name: /add job/i }))
    await waitFor(() => {
      const post = calls.find((c) => c.method === "POST")
      expect(post?.body).toEqual({
        schedule: "0 3 * * *",
        command: "node cleanup.js",
        service: "app",
      })
    })
  })
})
