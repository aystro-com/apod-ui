import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { SiteCreatePage } from "./site-create"

function setup(extra: Record<string, unknown> = {}) {
  return mockApi({
    "GET /api/v1/drivers": [{ name: "php" }, { name: "node" }],
    "GET /api/v1/users": [],
    ...extra,
  })
}

describe("SiteCreatePage", () => {
  it("rejects an invalid domain before calling the API", async () => {
    const { calls } = setup()
    renderWithProviders(<SiteCreatePage />)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/domain/i), "not a domain")
    await user.click(screen.getByRole("button", { name: /create site/i }))
    expect(await screen.findByText(/valid domain/i)).toBeInTheDocument()
    expect(calls.some((c) => c.method === "POST")).toBe(false)
  })

  it("requires a driver", async () => {
    const { calls } = setup()
    renderWithProviders(<SiteCreatePage />)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/domain/i), "new.example.com")
    await user.click(screen.getByRole("button", { name: /create site/i }))
    expect(await screen.findByText(/choose a driver/i)).toBeInTheDocument()
    expect(calls.some((c) => c.method === "POST")).toBe(false)
  })

  it("requires compose content when the Compose file tab is selected", async () => {
    const { calls } = setup()
    renderWithProviders(<SiteCreatePage />)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/domain/i), "new.example.com")
    await user.click(screen.getByRole("tab", { name: /compose file/i }))
    await user.click(screen.getByRole("button", { name: /create site/i }))
    expect(await screen.findByText(/paste a docker-compose/i)).toBeInTheDocument()
    expect(calls.some((c) => c.method === "POST")).toBe(false)
  })

  it("creates a site from a pasted docker-compose.yml (no driver)", async () => {
    const { calls } = setup({
      "POST /api/v1/sites": makeSite({ domain: "app.example.com" }),
    })
    renderWithProviders(<SiteCreatePage />, { route: "/sites/new" })
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/domain/i), "app.example.com")

    await user.click(screen.getByRole("tab", { name: /compose file/i }))
    const compose = "services:\n  web:\n    image: nginx\n    ports:\n      - 8080:80\n"
    await user.click(screen.getByLabelText(/docker-compose\.yml/i))
    await user.paste(compose)

    await user.click(screen.getByRole("button", { name: /create site/i }))
    await waitFor(() => {
      const post = calls.find(
        (c) => c.method === "POST" && c.path === "/api/v1/sites",
      )
      expect(post?.body).toMatchObject({
        domain: "app.example.com",
        compose_file: compose,
      })
      // No driver is sent in compose mode.
      expect((post?.body as Record<string, unknown>).driver).toBeUndefined()
    })
  })

  it("creates a site with the chosen driver and limits", async () => {
    const { calls } = setup({
      "POST /api/v1/sites": makeSite({ domain: "new.example.com" }),
    })
    renderWithProviders(<SiteCreatePage />, { route: "/sites/new" })
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/domain/i), "NEW.Example.com")

    await user.click(screen.getByRole("combobox", { name: /driver/i }))
    await user.click(await screen.findByRole("option", { name: "php" }))

    await user.click(screen.getByRole("button", { name: /create site/i }))
    await waitFor(() => {
      const post = calls.find(
        (c) => c.method === "POST" && c.path === "/api/v1/sites",
      )
      expect(post?.body).toMatchObject({
        domain: "new.example.com", // lowercased
        driver: "php",
        ram: "512M",
        cpu: "1",
      })
    })
  })
})
