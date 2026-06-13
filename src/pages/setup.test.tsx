import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import { mockApi, TEST_BASE } from "@/test/utils"
import { AuthProvider, useAuth } from "@/lib/auth"
import { SetupPage } from "./setup"

function Probe() {
  const { session } = useAuth()
  return session ? <p>connected as {session.name}</p> : <SetupPage baseUrl={TEST_BASE} />
}

function renderSetup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe("SetupPage", () => {
  it("creates the first admin and signs in", async () => {
    const { calls } = mockApi({
      "POST /api/v1/setup": { name: "root", role: "admin" },
      "POST /api/v1/auth/login": {
        token: "apod_sess_first",
        user: { name: "root", role: "admin" },
      },
    })
    renderSetup()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/admin username/i), "root")
    await user.type(screen.getByLabelText(/password/i), "a-strong-password")
    await user.click(screen.getByRole("button", { name: /create admin/i }))

    expect(await screen.findByText(/connected as root/)).toBeInTheDocument()
    expect(calls.some((c) => c.path === "/api/v1/setup")).toBe(true)
    // After setup it logs in automatically.
    expect(calls.some((c) => c.path === "/api/v1/auth/login")).toBe(true)
  })

  it("validates the password length", async () => {
    const { calls } = mockApi({})
    renderSetup()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/admin username/i), "root")
    await user.type(screen.getByLabelText(/password/i), "short")
    await user.click(screen.getByRole("button", { name: /create admin/i }))
    expect(await screen.findByText(/at least 8/i)).toBeInTheDocument()
    expect(calls.some((c) => c.path === "/api/v1/setup")).toBe(false)
  })
})
