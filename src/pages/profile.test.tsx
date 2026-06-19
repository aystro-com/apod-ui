import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { mockApi, renderWithProviders } from "@/test/utils"
import { ProfilePage } from "./profile"

function baseRoutes(extra: Record<string, unknown> = {}) {
  return mockApi({
    "GET /api/v1/auth/me": { name: "alice", role: "user", totp_enabled: false },
    "GET /api/v1/tokens": { tokens: [] },
    ...extra,
  })
}

describe("ProfilePage — password", () => {
  it("changes the current user's password", async () => {
    const { calls } = baseRoutes({
      "POST /api/v1/users/alice/password": { status: "password_set" },
    })
    renderWithProviders(<ProfilePage />, { role: "user" })
    const user = userEvent.setup()
    await user.type(
      await screen.findByLabelText(/current password/i),
      "the-old-password",
    )
    await user.type(
      await screen.findByLabelText(/new password/i),
      "a-brand-new-password",
    )
    await user.click(screen.getByRole("button", { name: /update password/i }))
    await waitFor(() => {
      const call = calls.find((c) => c.path === "/api/v1/users/alice/password")
      expect(call?.body).toMatchObject({
        password: "a-brand-new-password",
        current_password: "the-old-password",
      })
    })
  })

  it("rejects short passwords client-side", async () => {
    const { calls } = baseRoutes()
    renderWithProviders(<ProfilePage />, { role: "user" })
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/new password/i), "short")
    await user.click(screen.getByRole("button", { name: /update password/i }))
    expect(await screen.findByText(/at least 8/i)).toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith("/password"))).toBe(false)
  })
})

describe("ProfilePage — two-factor", () => {
  it("enrolls in 2FA and shows recovery codes", async () => {
    const { calls } = baseRoutes({
      "POST /api/v1/auth/2fa/setup": {
        secret: "JBSWY3DPEHPK3PXP",
        uri: "otpauth://totp/apod:alice?secret=JBSWY3DPEHPK3PXP&issuer=apod",
      },
      "POST /api/v1/auth/2fa/enable": {
        recovery_codes: ["aaaa1111", "bbbb2222"],
      },
    })
    renderWithProviders(<ProfilePage />, { role: "user" })
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: /enable 2fa/i }))
    // The secret is shown so the user can add it to their app.
    expect(await screen.findByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument()

    await user.type(screen.getByLabelText(/verification code/i), "123456")
    await user.click(screen.getByRole("button", { name: /verify and enable/i }))

    // Recovery codes are surfaced exactly once.
    expect(await screen.findByText("aaaa1111")).toBeInTheDocument()
    expect(screen.getByText("bbbb2222")).toBeInTheDocument()
    const enable = calls.find((c) => c.path === "/api/v1/auth/2fa/enable")
    expect(enable?.body).toEqual({ code: "123456" })
  })

  it("offers to disable 2FA when already enabled", async () => {
    const { calls } = baseRoutes({
      "GET /api/v1/auth/me": { name: "alice", role: "user", totp_enabled: true },
      "POST /api/v1/auth/2fa/disable": { status: "2fa_disabled" },
    })
    renderWithProviders(<ProfilePage />, { role: "user" })
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /disable 2fa/i }))
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByLabelText(/code/i), "654321")
    await user.click(within(dialog).getByRole("button", { name: /disable/i }))
    await waitFor(() => {
      const call = calls.find((c) => c.path === "/api/v1/auth/2fa/disable")
      expect(call?.body).toEqual({ code: "654321" })
    })
  })
})

describe("ProfilePage — scoped tokens", () => {
  it("lists existing tokens with their abilities", async () => {
    baseRoutes({
      "GET /api/v1/tokens": {
        tokens: [
          {
            id: 1,
            user_name: "alice",
            name: "ci-deploy",
            abilities: "read,deploy",
            sensitive: false,
            expires_at: null,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      },
    })
    renderWithProviders(<ProfilePage />, { role: "user" })
    expect(await screen.findByText("ci-deploy")).toBeInTheDocument()
    expect(screen.getByText("read,deploy")).toBeInTheDocument()
  })

  it("creates a scoped token and shows it once", async () => {
    const { calls } = baseRoutes({
      "POST /api/v1/tokens": { token: "apod_pat_secretvalue" },
    })
    renderWithProviders(<ProfilePage />, { role: "user" })
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText(/token name/i), "ci")
    // read is on by default; add deploy.
    await user.click(screen.getByRole("checkbox", { name: /deploy/i }))
    await user.click(screen.getByRole("button", { name: /create token/i }))

    expect(await screen.findByText("apod_pat_secretvalue")).toBeInTheDocument()
    const call = calls.find((c) => c.method === "POST" && c.path === "/api/v1/tokens")
    expect(call?.body).toMatchObject({
      name: "ci",
      abilities: expect.arrayContaining(["read", "deploy"]),
      sensitive: false,
    })
  })

  it("revokes a token after confirmation", async () => {
    const { calls } = baseRoutes({
      "GET /api/v1/tokens": {
        tokens: [
          {
            id: 7,
            user_name: "alice",
            name: "old",
            abilities: "read",
            sensitive: false,
            expires_at: null,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      },
      "DELETE /api/v1/tokens": { status: "revoked" },
    })
    renderWithProviders(<ProfilePage />, { role: "user" })
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /revoke old/i }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: /revoke/i }))
    await waitFor(() => {
      const call = calls.find(
        (c) => c.method === "DELETE" && c.path === "/api/v1/tokens",
      )
      expect(call?.body).toEqual({ id: 7 })
    })
  })
})
