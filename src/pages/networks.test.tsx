import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { mockApi, renderWithProviders } from "@/test/utils"
import { NetworksPage } from "./networks"

describe("NetworksPage", () => {
  it("lists networks with their members", async () => {
    mockApi({
      "GET /api/v1/networks": [
        { name: "analytics", owner: "admin", members: ["erp.example.com"] },
      ],
      "GET /api/v1/sites": [],
    })
    renderWithProviders(<NetworksPage />)
    expect(await screen.findByText("analytics")).toBeInTheDocument()
    expect(screen.getByText("erp.example.com")).toBeInTheDocument()
  })

  it("survives a network whose members come back null", async () => {
    // The server can return members: null for a brand-new empty network.
    mockApi({
      "GET /api/v1/networks": [
        { name: "fresh", owner: "admin", members: null },
      ],
      "GET /api/v1/sites": [{ domain: "a.example.com" }],
    })
    renderWithProviders(<NetworksPage />)
    expect(await screen.findByText("fresh")).toBeInTheDocument()
    expect(screen.getByText(/0 sites/i)).toBeInTheDocument()
  })

  it("creates a network", async () => {
    const { calls } = mockApi({
      "GET /api/v1/networks": [],
      "GET /api/v1/sites": [],
      "POST /api/v1/networks": { name: "analytics" },
    })
    renderWithProviders(<NetworksPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /create network/i }))
    await user.type(screen.getByLabelText(/name/i), "analytics")
    await user.click(screen.getByRole("button", { name: /^create$/i }))
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.path === "/api/v1/networks" &&
            JSON.stringify(c.body) === JSON.stringify({ name: "analytics" }),
        ),
      ).toBe(true)
    })
  })
})
