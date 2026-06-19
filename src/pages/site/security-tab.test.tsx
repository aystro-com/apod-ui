import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { SecurityTab } from "./security-tab"

const site = makeSite()

function setup(extra: Record<string, unknown> = {}) {
  return mockApi({
    "GET /api/v1/sites/example.com/proxy": [
      {
        id: 1,
        site_domain: "example.com",
        rule_type: "redirect",
        config: JSON.stringify({ from: "/old", to: "/new" }),
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    "GET /api/v1/sites/example.com/ip": [
      {
        id: 5,
        site_domain: "example.com",
        ip: "1.2.3.4",
        action: "block",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    "GET /api/v1/sites/example.com/ftp": [
      {
        id: 9,
        site_domain: "example.com",
        username: "deploy",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    ...extra,
  })
}

describe("SecurityTab", () => {
  it("lists proxy rules, blocked IPs, and FTP accounts", async () => {
    setup()
    renderWithProviders(<SecurityTab site={site} />)
    expect(await screen.findByText("redirect")).toBeInTheDocument()
    expect(await screen.findByText("1.2.3.4")).toBeInTheDocument()
    expect(await screen.findByText("deploy")).toBeInTheDocument()
  })

  it("allows a CIDR range (advertised in the placeholder)", async () => {
    const { calls } = setup({
      "POST /api/v1/sites/example.com/ip/allow": { status: "allowed" },
    })
    renderWithProviders(<SecurityTab site={site} />)
    const user = userEvent.setup()
    const input = await screen.findByPlaceholderText(/203\.0\.113|10\.0\.0\.0/i)
    await user.type(input, "10.0.0.0/8")
    await user.click(screen.getByRole("button", { name: /^allow$/i }))
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.path === "/api/v1/sites/example.com/ip/allow" &&
            JSON.stringify(c.body) === JSON.stringify({ ip: "10.0.0.0/8" }),
        ),
      ).toBe(true)
    })
  })

  it("allows an IP address (allowlist mode)", async () => {
    const { calls } = setup({
      "POST /api/v1/sites/example.com/ip/allow": { status: "allowed" },
    })
    renderWithProviders(<SecurityTab site={site} />)
    const user = userEvent.setup()
    const input = await screen.findByPlaceholderText(/203\.0\.113|10\.0\.0\.0/i)
    await user.type(input, "203.0.113.7")
    await user.click(screen.getByRole("button", { name: /^allow$/i }))
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.path === "/api/v1/sites/example.com/ip/allow" &&
            JSON.stringify(c.body) === JSON.stringify({ ip: "203.0.113.7" }),
        ),
      ).toBe(true)
    })
  })

  it("rejects an invalid IP address without calling the API", async () => {
    const { calls } = setup()
    renderWithProviders(<SecurityTab site={site} />)
    const user = userEvent.setup()
    const input = await screen.findByPlaceholderText(/203\.0\.113|ip address/i)
    await user.type(input, "not-an-ip")
    await user.click(screen.getByRole("button", { name: /^allow$/i }))
    expect(await screen.findByText(/valid ip/i)).toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith("/ip/allow"))).toBe(false)
  })

  it("creates an FTP account", async () => {
    const { calls } = setup({
      "POST /api/v1/sites/example.com/ftp": { status: "created" },
    })
    renderWithProviders(<SecurityTab site={site} />)
    const user = userEvent.setup()
    await user.type(await screen.findByPlaceholderText(/username/i), "alice")
    await user.type(screen.getByPlaceholderText(/password/i), "s3cret-pass")
    await user.click(screen.getByRole("button", { name: /add account/i }))
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.path === "/api/v1/sites/example.com/ftp" &&
            c.method === "POST" &&
            JSON.stringify(c.body) ===
              JSON.stringify({ username: "alice", password: "s3cret-pass" }),
        ),
      ).toBe(true)
    })
  })
})
