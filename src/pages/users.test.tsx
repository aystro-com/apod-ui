import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { mockApi, renderWithProviders } from "@/test/utils"
import { UsersPage } from "./users"

const users = [
  {
    id: 1,
    name: "client1",
    uid: 5001,
    role: "user",
    has_password: false,
    created_at: "2026-01-01T00:00:00Z",
  },
]

describe("UsersPage", () => {
  it("lists users with their role", async () => {
    mockApi({ "GET /api/v1/users": users })
    renderWithProviders(<UsersPage />)
    const nameCell = await screen.findByText("client1")
    const row = nameCell.closest("tr")!
    expect(within(row).getByText("user")).toBeInTheDocument()
    expect(within(row).getByText("5001")).toBeInTheDocument()
  })

  it("creates a user and shows the API key exactly once", async () => {
    mockApi({
      "GET /api/v1/users": users,
      "POST /api/v1/users": {
        user: {
          id: 2,
          name: "client2",
          uid: 5002,
          role: "user",
          created_at: "2026-01-01T00:00:00Z",
        },
        api_key: "apod_newkey_once",
      },
    })
    renderWithProviders(<UsersPage />)
    const user = userEvent.setup()
    await user.type(await screen.findByPlaceholderText(/name/i), "client2")
    await user.click(screen.getByRole("button", { name: /create user/i }))
    // The new API key must be surfaced to the operator (it is shown only once).
    expect(await screen.findByText("apod_newkey_once")).toBeInTheDocument()
    expect(screen.getByText(/only.*once|won't be shown again|shown only once/i)).toBeInTheDocument()
  })

  it("resets a user's API key after confirmation", async () => {
    const { calls } = mockApi({
      "GET /api/v1/users": users,
      "POST /api/v1/users/client1/reset-key": {
        api_key: "apod_rotated",
      },
    })
    renderWithProviders(<UsersPage />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", { name: /reset key/i }),
    )
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: /reset/i }))
    expect(await screen.findByText("apod_rotated")).toBeInTheDocument()
    expect(
      calls.some((c) => c.path === "/api/v1/users/client1/reset-key"),
    ).toBe(true)
  })

  it("sets a login password for a user", async () => {
    const { calls } = mockApi({
      "GET /api/v1/users": users,
      "POST /api/v1/users/client1/password": { status: "password_set" },
    })
    renderWithProviders(<UsersPage />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", { name: /set password/i }),
    )
    const dialog = await screen.findByRole("dialog")
    await user.type(
      within(dialog).getByLabelText(/new password/i),
      "a-long-password",
    )
    await user.click(within(dialog).getByRole("button", { name: /^save/i }))
    await waitFor(() => {
      const call = calls.find(
        (c) => c.path === "/api/v1/users/client1/password",
      )
      expect(call?.body).toEqual({ password: "a-long-password" })
    })
  })

  it("rejects passwords under 8 characters before calling the API", async () => {
    const { calls } = mockApi({ "GET /api/v1/users": users })
    renderWithProviders(<UsersPage />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", { name: /set password/i }),
    )
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByLabelText(/new password/i), "short")
    await user.click(within(dialog).getByRole("button", { name: /^save/i }))
    expect(
      await within(dialog).findByText(/at least 8 characters/i),
    ).toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith("/password"))).toBe(false)
  })

  it("shows whether a user has a login password", async () => {
    mockApi({
      "GET /api/v1/users": [
        { ...users[0], has_password: true },
        {
          id: 2,
          name: "client2",
          uid: 5002,
          role: "user",
          has_password: false,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    })
    renderWithProviders(<UsersPage />)
    const row1 = (await screen.findByText("client1")).closest("tr")!
    const row2 = screen.getByText("client2").closest("tr")!
    expect(within(row1).getByText(/password login/i)).toBeInTheDocument()
    expect(within(row2).getByText(/key only/i)).toBeInTheDocument()
  })

  it("deletes a user after type-to-confirm", async () => {
    const { calls } = mockApi({
      "GET /api/v1/users": users,
      "DELETE /api/v1/users/client1": { status: "deleted" },
    })
    renderWithProviders(<UsersPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /delete/i }))
    const dialog = await screen.findByRole("alertdialog")
    await user.type(within(dialog).getByRole("textbox"), "client1")
    await user.click(within(dialog).getByRole("button", { name: /delete/i }))
    await waitFor(() => {
      expect(
        calls.some(
          (c) => c.method === "DELETE" && c.path === "/api/v1/users/client1",
        ),
      ).toBe(true)
    })
  })
})
