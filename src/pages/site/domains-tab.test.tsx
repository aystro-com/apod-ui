import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { DomainsTab } from "./domains-tab"

const site = makeSite()

describe("DomainsTab", () => {
  it("lists domains and marks the primary one", async () => {
    mockApi({
      "GET /api/v1/sites/example.com/domains": ["example.com", "www.example.com"],
    })
    renderWithProviders(<DomainsTab site={site} />)
    expect(await screen.findByText("www.example.com")).toBeInTheDocument()
    const primaryRow = screen.getByText("example.com").closest("tr")!
    expect(within(primaryRow).getByText("primary")).toBeInTheDocument()
    // The primary domain cannot be removed.
    expect(
      within(primaryRow).queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument()
  })

  it("adds an alias domain lowercased", async () => {
    const { calls } = mockApi({
      "GET /api/v1/sites/example.com/domains": ["example.com"],
      "POST /api/v1/sites/example.com/domains": { status: "added" },
    })
    renderWithProviders(<DomainsTab site={site} />)
    const user = userEvent.setup()
    await user.type(
      await screen.findByPlaceholderText(/alias/i),
      "Shop.Example.com",
    )
    await user.click(screen.getByRole("button", { name: /add domain/i }))
    await waitFor(() => {
      const post = calls.find((c) => c.method === "POST")
      expect(post?.body).toEqual({ domain: "shop.example.com" })
    })
  })

  it("removes an alias after confirmation", async () => {
    const { calls } = mockApi({
      "GET /api/v1/sites/example.com/domains": ["example.com", "old.example.com"],
      "DELETE /api/v1/sites/example.com/domains/old.example.com": {
        status: "removed",
      },
    })
    renderWithProviders(<DomainsTab site={site} />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", { name: /remove old\.example\.com/i }),
    )
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: /^remove$/i }))
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.method === "DELETE" &&
            c.path === "/api/v1/sites/example.com/domains/old.example.com",
        ),
      ).toBe(true)
    })
  })
})
