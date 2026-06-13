import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { ConsoleTab } from "./console-tab"

const site = makeSite()

describe("ConsoleTab", () => {
  it("starts a session, runs a command, and shows its output", async () => {
    const { calls } = mockApi({
      "POST /api/v1/sites/example.com/terminal": {
        token: "term_abc",
        domain: "example.com",
        expires_at: new Date(Date.now() + 300_000).toISOString(),
      },
      "POST /api/v1/terminal/exec": { output: "total 0\nfile.txt" },
    })
    renderWithProviders(<ConsoleTab site={site} />)
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: /start session/i }),
    )
    const input = await screen.findByPlaceholderText(/command/i)
    await user.type(input, "ls -la{Enter}")

    expect(await screen.findByText(/file\.txt/)).toBeInTheDocument()
    const exec = calls.find((c) => c.path === "/api/v1/terminal/exec")
    expect(exec?.body).toEqual({ token: "term_abc", command: "ls -la" })
  })

  it("does not offer a session when the site is stopped", async () => {
    mockApi({})
    renderWithProviders(<ConsoleTab site={makeSite({ status: "stopped" })} />)
    expect(await screen.findByText(/not running/i)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /start session/i }),
    ).not.toBeInTheDocument()
  })
})
