import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { LogsTab } from "./logs-tab"

const site = makeSite()

describe("LogsTab", () => {
  it("shows container logs and activity history", async () => {
    mockApi({
      "GET /api/v1/sites/example.com/container-logs": {
        logs: "hello from nginx\nsecond line",
      },
      "GET /api/v1/sites/example.com/logs": [
        {
          id: 1,
          site_domain: "example.com",
          action: "deploy",
          details: "branch main",
          result: "success",
          created_at: "2026-01-02T03:04:05Z",
        },
      ],
    })
    renderWithProviders(<LogsTab site={site} />)
    expect(await screen.findByText(/hello from nginx/)).toBeInTheDocument()
    expect(await screen.findByText("deploy")).toBeInTheDocument()
    expect(screen.getByText("branch main")).toBeInTheDocument()
  })

  it("shows an empty state when there are no logs", async () => {
    mockApi({
      "GET /api/v1/sites/example.com/container-logs": { logs: "" },
      "GET /api/v1/sites/example.com/logs": [],
    })
    renderWithProviders(<LogsTab site={site} />)
    expect(await screen.findByText(/no output/i)).toBeInTheDocument()
    expect(await screen.findByText(/no activity/i)).toBeInTheDocument()
  })
})
