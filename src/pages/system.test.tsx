import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { mockApi, renderWithProviders } from "@/test/utils"
import { SystemPage } from "./system"

function setup(extra: Record<string, unknown> = {}) {
  return mockApi({
    "GET /api/v1/version": { version: "1.4.0", db_version: 12 },
    "GET /api/v1/update/check": { latest: "1.5.0", has_update: true },
    "GET /api/v1/drivers": [
      { name: "php", description: "PHP + Nginx + MySQL" },
      { name: "node", description: "Node.js + PostgreSQL" },
    ],
    "GET /api/v1/firewall": { enabled: true, rules: ["80/tcp ALLOW", "443/tcp ALLOW"] },
    "GET /api/v1/ssh-keys": [
      {
        id: 1,
        name: "laptop",
        public_key: "ssh-ed25519 AAAA... user@laptop",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    "GET /api/v1/disk-usage": [{ domain: "example.com", size_mb: 1024 }],
    ...extra,
  })
}

describe("SystemPage", () => {
  it("shows version, update availability, drivers, firewall, and SSH keys", async () => {
    setup()
    renderWithProviders(<SystemPage />)
    expect(await screen.findByText(/1\.4\.0/)).toBeInTheDocument()
    expect(await screen.findByText(/1\.5\.0/)).toBeInTheDocument()
    expect(await screen.findByText("php")).toBeInTheDocument()
    expect(await screen.findByText("laptop")).toBeInTheDocument()
    expect(await screen.findByText(/80\/tcp/)).toBeInTheDocument()
  })

  it("allows a firewall port with validation", async () => {
    const { calls } = setup({
      "POST /api/v1/firewall/allow": { status: "allowed" },
    })
    renderWithProviders(<SystemPage />)
    const user = userEvent.setup()
    const input = await screen.findByPlaceholderText(/port/i)
    await user.type(input, "8080")
    await user.click(screen.getByRole("button", { name: /^allow/i }))
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.path === "/api/v1/firewall/allow" &&
            JSON.stringify(c.body) === JSON.stringify({ port: "8080" }),
        ),
      ).toBe(true)
    })
  })

  it("rejects an invalid port without calling the API", async () => {
    const { calls } = setup()
    renderWithProviders(<SystemPage />)
    const user = userEvent.setup()
    const input = await screen.findByPlaceholderText(/port/i)
    await user.type(input, "99999")
    await user.click(screen.getByRole("button", { name: /^allow/i }))
    expect(await screen.findByText(/valid port/i)).toBeInTheDocument()
    expect(calls.some((c) => c.path === "/api/v1/firewall/allow")).toBe(false)
  })

  it("adds an SSH key", async () => {
    const { calls } = setup({
      "POST /api/v1/ssh-keys": { status: "added" },
    })
    renderWithProviders(<SystemPage />)
    const user = userEvent.setup()
    await user.type(await screen.findByPlaceholderText(/key name/i), "desktop")
    await user.type(
      screen.getByPlaceholderText(/ssh-ed25519/i),
      "ssh-ed25519 AAAAC3Nza me@desktop",
    )
    await user.click(screen.getByRole("button", { name: /add key/i }))
    await waitFor(() => {
      const call = calls.find(
        (c) => c.method === "POST" && c.path === "/api/v1/ssh-keys",
      )
      expect(call?.body).toEqual({
        name: "desktop",
        public_key: "ssh-ed25519 AAAAC3Nza me@desktop",
      })
    })
  })
})
