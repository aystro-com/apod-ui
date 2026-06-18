import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { mockApi, renderWithProviders, TEST_BASE } from "@/test/utils"
import { AppLayout } from "./app-layout"

describe("AppLayout", () => {
  it("shows the admin-only navigation for an admin session", async () => {
    mockApi({})
    renderWithProviders(<AppLayout />, { role: "admin" })

    expect(await screen.findByRole("link", { name: /Dashboard/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Sites/ })).toBeInTheDocument()
    // Administration group.
    expect(screen.getByRole("link", { name: /Users/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /System/ })).toBeInTheDocument()
    expect(screen.getByText("Administrator session")).toBeInTheDocument()
  })

  it("hides the admin navigation for a non-admin session", async () => {
    mockApi({})
    renderWithProviders(<AppLayout />, { role: "user" })

    expect(await screen.findByRole("link", { name: /Dashboard/ })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Users/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /System/ })).not.toBeInTheDocument()
    expect(screen.getByText("User session")).toBeInTheDocument()
  })

  it("derives the server host from the session base URL", async () => {
    mockApi({})
    renderWithProviders(<AppLayout />)
    expect(await screen.findByText(new URL(TEST_BASE).host)).toBeInTheDocument()
  })

  it("toggles the theme class on the document root", async () => {
    mockApi({})
    document.documentElement.classList.remove("dark")
    renderWithProviders(<AppLayout />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Toggle theme" }))
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem("apod.theme")).toBe("dark")

    await user.click(screen.getByRole("button", { name: "Toggle theme" }))
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("disconnects the session when Disconnect is clicked", async () => {
    mockApi({})
    renderWithProviders(<AppLayout />)
    const user = userEvent.setup()

    expect(sessionStorage.getItem("apod.connection")).not.toBeNull()
    await user.click(await screen.findByRole("button", { name: /Disconnect/ }))
    await waitFor(() =>
      expect(sessionStorage.getItem("apod.connection")).toBeNull(),
    )
  })
})
