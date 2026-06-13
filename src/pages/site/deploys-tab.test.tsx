import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { DeploysTab } from "./deploys-tab"

const gitSite = makeSite({ repo: "https://github.com/me/app.git", branch: "main" })

function setup(extra: Record<string, unknown> = {}) {
  return mockApi({
    "GET /api/v1/sites/example.com/deployments": [
      {
        id: 1,
        site_domain: "example.com",
        commit_hash: "abcdef1234567890",
        branch: "main",
        status: "success",
        previous_image: "",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    "GET /api/v1/sites/example.com/webhook": [],
    ...extra,
  })
}

describe("DeploysTab", () => {
  it("shows deployment history with short hashes", async () => {
    setup()
    renderWithProviders(<DeploysTab site={gitSite} />)
    expect(await screen.findByText("abcdef1")).toBeInTheDocument()
    expect(screen.getByText("success")).toBeInTheDocument()
  })

  it("triggers a deploy", async () => {
    const { calls } = setup({
      "POST /api/v1/sites/example.com/deploy": { status: "deployed" },
    })
    renderWithProviders(<DeploysTab site={gitSite} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /deploy now/i }))
    await waitFor(() => {
      expect(
        calls.some((c) => c.path === "/api/v1/sites/example.com/deploy"),
      ).toBe(true)
    })
  })

  it("disables deploy when no repo is configured", async () => {
    setup()
    renderWithProviders(<DeploysTab site={makeSite({ repo: "" })} />)
    expect(
      await screen.findByRole("button", { name: /deploy now/i }),
    ).toBeDisabled()
  })

  it("creates a webhook and shows its URL", async () => {
    const { calls } = setup({
      "POST /api/v1/sites/example.com/webhook": {
        token: "wh_tok123",
        url: "/webhook/wh_tok123",
      },
    })
    renderWithProviders(<DeploysTab site={gitSite} />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", { name: /create webhook/i }),
    )
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.method === "POST" &&
            c.path === "/api/v1/sites/example.com/webhook",
        ),
      ).toBe(true)
    })
  })
})
