import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { SitesPage } from "./sites"

const sites = [
  makeSite({ domain: "alpha.com", driver: "php", owner: "client1" }),
  makeSite({ id: 2, domain: "beta.io", driver: "node", status: "stopped" }),
]

describe("SitesPage", () => {
  it("lists sites with status, driver, and owner", async () => {
    mockApi({ "GET /api/v1/sites": sites })
    renderWithProviders(<SitesPage />)
    expect(await screen.findByText("alpha.com")).toBeInTheDocument()
    expect(screen.getByText("beta.io")).toBeInTheDocument()
    expect(screen.getByText("client1")).toBeInTheDocument()
    expect(screen.getByText("stopped")).toBeInTheDocument()
  })

  it("filters by domain", async () => {
    mockApi({ "GET /api/v1/sites": sites })
    renderWithProviders(<SitesPage />)
    await screen.findByText("alpha.com")
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/filter/i), "beta")
    expect(screen.queryByText("alpha.com")).not.toBeInTheDocument()
    expect(screen.getByText("beta.io")).toBeInTheDocument()
  })

  it("filters by driver too", async () => {
    mockApi({ "GET /api/v1/sites": sites })
    renderWithProviders(<SitesPage />)
    await screen.findByText("alpha.com")
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/filter/i), "node")
    expect(screen.queryByText("alpha.com")).not.toBeInTheDocument()
    expect(screen.getByText("beta.io")).toBeInTheDocument()
  })
})
