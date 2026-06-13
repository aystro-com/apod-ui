import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { SettingsTab } from "./settings-tab"

const site = makeSite()

function setup(extra: Record<string, unknown> = {}) {
  return mockApi({
    "GET /api/v1/sites/example.com/config": {
      ram: "512M",
      cpu: "1",
      storage: "5G",
      repo: "",
      branch: "",
    },
    ...extra,
  })
}

describe("SettingsTab", () => {
  it("renders current configuration values", async () => {
    setup()
    renderWithProviders(<SettingsTab site={site} />)
    expect(await screen.findByDisplayValue("512M")).toBeInTheDocument()
    expect(screen.getByDisplayValue("5G")).toBeInTheDocument()
  })

  it("saves a changed config value", async () => {
    const { calls } = setup({
      "POST /api/v1/sites/example.com/config": { status: "set" },
    })
    renderWithProviders(<SettingsTab site={site} />)
    const user = userEvent.setup()
    const ram = await screen.findByLabelText(/ram/i)
    await user.clear(ram)
    await user.type(ram, "1G")
    await user.click(screen.getByRole("button", { name: /save/i }))
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.path === "/api/v1/sites/example.com/config" &&
            JSON.stringify(c.body) === JSON.stringify({ key: "ram", value: "1G" }),
        ),
      ).toBe(true)
    })
  })

  it("requires typing the domain before destroying the site", async () => {
    const { calls } = setup({
      "DELETE /api/v1/sites/example.com": { status: "destroyed" },
    })
    renderWithProviders(<SettingsTab site={site} />)
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: /destroy site/i }),
    )
    const dialog = await screen.findByRole("alertdialog")
    const confirm = within(dialog).getByRole("button", { name: /destroy/i })
    expect(confirm).toBeDisabled()

    await user.type(
      within(dialog).getByRole("textbox"),
      "example.com",
    )
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    await waitFor(() => {
      expect(
        calls.some(
          (c) => c.method === "DELETE" && c.path === "/api/v1/sites/example.com",
        ),
      ).toBe(true)
    })
  })

  it("clones the site to a new domain", async () => {
    const { calls } = setup({
      "POST /api/v1/sites/example.com/clone": { status: "cloned" },
    })
    renderWithProviders(<SettingsTab site={site} />)
    const user = userEvent.setup()
    await user.type(
      await screen.findByPlaceholderText(/copy\.example\.com|target domain/i),
      "copy.example.com",
    )
    await user.click(screen.getByRole("button", { name: /^clone/i }))
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.path === "/api/v1/sites/example.com/clone" &&
            JSON.stringify(c.body) ===
              JSON.stringify({ target: "copy.example.com" }),
        ),
      ).toBe(true)
    })
  })
})
