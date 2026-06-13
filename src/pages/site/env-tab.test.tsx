import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { makeSite, mockApi, renderWithProviders } from "@/test/utils"
import { EnvTab } from "./env-tab"

const site = makeSite()

describe("EnvTab", () => {
  it("masks values until revealed", async () => {
    mockApi({
      "GET /api/v1/sites/example.com/env": { DB_PASS: "supersecret" },
    })
    renderWithProviders(<EnvTab site={site} />)
    expect(await screen.findByText("DB_PASS")).toBeInTheDocument()
    expect(screen.queryByText("supersecret")).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /reveal value/i }))
    expect(screen.getByText("supersecret")).toBeInTheDocument()
  })

  it("validates keys before setting", async () => {
    const { calls } = mockApi({
      "GET /api/v1/sites/example.com/env": {},
    })
    renderWithProviders(<EnvTab site={site} />)
    const user = userEvent.setup()
    await user.type(await screen.findByPlaceholderText("KEY"), "1BAD KEY")
    await user.type(screen.getByPlaceholderText("value"), "x")
    await user.click(screen.getByRole("button", { name: /^set$/i }))
    expect(await screen.findByText(/keys must match/i)).toBeInTheDocument()
    expect(calls.some((c) => c.method === "POST")).toBe(false)
  })

  it("sets a valid variable", async () => {
    const { calls } = mockApi({
      "GET /api/v1/sites/example.com/env": {},
      "POST /api/v1/sites/example.com/env": { status: "set" },
    })
    renderWithProviders(<EnvTab site={site} />)
    const user = userEvent.setup()
    await user.type(await screen.findByPlaceholderText("KEY"), "DB_HOST")
    await user.type(screen.getByPlaceholderText("value"), "localhost")
    await user.click(screen.getByRole("button", { name: /^set$/i }))
    await waitFor(() => {
      const post = calls.find((c) => c.method === "POST")
      expect(post?.body).toEqual({ key: "DB_HOST", value: "localhost" })
    })
  })
})
