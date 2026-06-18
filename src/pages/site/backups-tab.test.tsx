import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { BackupsTab } from "./backups-tab"

const site = makeSite()

function setup(extra: Record<string, unknown> = {}) {
  return mockApi({
    "GET /api/v1/sites/example.com/backups": [
      {
        id: 7,
        site_domain: "example.com",
        storage_name: "",
        path: "/backups/x.zip",
        size_bytes: 10 * 1024 * 1024,
        status: "completed",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    "GET /api/v1/sites/example.com/backups/schedule": [],
    "GET /api/v1/storage": [],
    ...extra,
  })
}

describe("BackupsTab", () => {
  it("lists backups with size and status", async () => {
    setup()
    renderWithProviders(<BackupsTab site={site} />)
    expect(await screen.findByText("#7")).toBeInTheDocument()
    expect(screen.getByText("10.0 MB")).toBeInTheDocument()
    expect(screen.getByText("completed")).toBeInTheDocument()
  })

  it("creates a new site from a backup", async () => {
    const { calls } = setup({
      "POST /api/v1/sites/example.com/backups/new-site": { status: "created" },
    })
    renderWithProviders(<BackupsTab site={site} />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", {
        name: /create a new site from backup #7/i,
      }),
    )
    await user.type(
      await screen.findByLabelText(/new domain/i),
      "staging.example.com",
    )
    await user.click(screen.getByRole("button", { name: /^create site$/i }))
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.path === "/api/v1/sites/example.com/backups/new-site" &&
            JSON.stringify(c.body) ===
              JSON.stringify({
                backup_id: 7,
                new_domain: "staging.example.com",
                owner: "",
              }),
        ),
      ).toBe(true)
    })
  })

  it("creates a backup", async () => {
    const { calls } = setup({
      "POST /api/v1/sites/example.com/backups": { backup_id: 8 },
    })
    renderWithProviders(<BackupsTab site={site} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /back up now/i }))
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.method === "POST" &&
            c.path === "/api/v1/sites/example.com/backups",
        ),
      ).toBe(true)
    })
  })

  it("restores only after confirmation", async () => {
    const { calls } = setup({
      "POST /api/v1/sites/example.com/backups/restore": { status: "restored" },
    })
    renderWithProviders(<BackupsTab site={site} />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", { name: /restore backup #7/i }),
    )
    expect(calls.some((c) => c.path.endsWith("/restore"))).toBe(false)
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: /^restore$/i }))
    await waitFor(() => {
      const post = calls.find((c) => c.path.endsWith("/restore"))
      expect(post?.body).toEqual({ backup_id: 7 })
    })
  })

  it("adds a daily schedule", async () => {
    const { calls } = setup({
      "POST /api/v1/sites/example.com/backups/schedule": { status: "added" },
    })
    renderWithProviders(<BackupsTab site={site} />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", { name: /add schedule/i }),
    )
    await waitFor(() => {
      const post = calls.find((c) => c.path.endsWith("/schedule") && c.method === "POST")
      expect(post?.body).toEqual({ every: "daily", keep: 7, storage: "" })
    })
  })
})
