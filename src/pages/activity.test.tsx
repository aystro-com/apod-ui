import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { mockApi, renderWithProviders } from "@/test/utils"
import { ActivityPage } from "./activity"

describe("ActivityPage", () => {
  it("lists operations across all sites", async () => {
    mockApi({
      "GET /api/v1/logs": [
        {
          id: 1,
          site_domain: "example.com",
          action: "create",
          details: "driver php",
          result: "success",
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: 2,
          site_domain: "other.com",
          action: "backup",
          details: "",
          result: "failed",
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
    })
    renderWithProviders(<ActivityPage />)
    expect(await screen.findByText("example.com")).toBeInTheDocument()
    expect(screen.getByText("backup")).toBeInTheDocument()
    expect(screen.getByText("failed")).toBeInTheDocument()
  })

  it("shows an empty state with no operations", async () => {
    mockApi({ "GET /api/v1/logs": [] })
    renderWithProviders(<ActivityPage />)
    expect(await screen.findByText(/no activity/i)).toBeInTheDocument()
  })
})
