import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { mockApi, TEST_BASE } from "@/test/utils"
import { AuthProvider, useAuth } from "@/lib/auth"
import { LoginPage } from "./login"

function Probe() {
  const { session } = useAuth()
  return session ? (
    <p>
      connected as {session.name} ({session.role})
    </p>
  ) : (
    <LoginPage />
  )
}

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe("LoginPage — password mode (default)", () => {
  it("signs in with username and password", async () => {
    mockApi({
      "POST /api/v1/auth/login": {
        token: "apod_sess_tok",
        user: { name: "alice", role: "user" },
      },
    })
    renderLogin()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/server url/i), TEST_BASE)
    await user.type(screen.getByLabelText(/username/i), "alice")
    await user.type(screen.getByLabelText(/^password/i, { selector: "input" }), "long-password")
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    expect(await screen.findByText(/connected as alice/)).toBeInTheDocument()
  })

  it("masks the password input", () => {
    mockApi({})
    renderLogin()
    expect(screen.getByLabelText(/^password/i, { selector: "input" })).toHaveAttribute("type", "password")
  })

  it("shows the server error on bad credentials", async () => {
    mockApi({
      "POST /api/v1/auth/login": {
        status: 401,
        error: "invalid username or password",
      },
    })
    renderLogin()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/server url/i), TEST_BASE)
    await user.type(screen.getByLabelText(/username/i), "alice")
    await user.type(screen.getByLabelText(/^password/i, { selector: "input" }), "wrong-password")
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument()
  })
})

describe("LoginPage — API key mode", () => {
  it("connects with an API key", async () => {
    mockApi({
      "GET /api/v1/sites": [],
      "GET /api/v1/auth/me": { name: "root", role: "admin" },
    })
    renderLogin()
    const user = userEvent.setup()
    await user.click(screen.getByRole("tab", { name: /api key/i }))
    await user.type(screen.getByLabelText(/server url/i), TEST_BASE)
    await user.type(await screen.findByLabelText(/api key/i, { selector: "input" }), "apod_secret")
    await user.click(screen.getByRole("button", { name: /connect/i }))
    expect(await screen.findByText(/connected as root \(admin\)/)).toBeInTheDocument()
  })

  it("masks the API key input", async () => {
    mockApi({})
    renderLogin()
    const user = userEvent.setup()
    await user.click(screen.getByRole("tab", { name: /api key/i }))
    expect(await screen.findByLabelText(/api key/i, { selector: "input" })).toHaveAttribute(
      "type",
      "password",
    )
  })

  it("shows the server error when the key is rejected", async () => {
    mockApi({
      "GET /api/v1/sites": { status: 401, error: "invalid API key" },
    })
    renderLogin()
    const user = userEvent.setup()
    await user.click(screen.getByRole("tab", { name: /api key/i }))
    await user.type(screen.getByLabelText(/server url/i), TEST_BASE)
    await user.type(await screen.findByLabelText(/api key/i, { selector: "input" }), "bad-key")
    await user.click(screen.getByRole("button", { name: /connect/i }))
    expect(await screen.findByText(/sign-in failed/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(/connected as/)).not.toBeInTheDocument()
    })
  })
})
