import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { mockApi, renderWithProviders } from "@/test/utils"
import { StoragePage } from "./storage"

describe("StoragePage", () => {
  it("lists configured storage backends", async () => {
    mockApi({
      "GET /api/v1/storage": [
        {
          id: 1,
          name: "my-s3",
          driver: "s3",
          config: "{}",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    })
    renderWithProviders(<StoragePage />)
    expect(await screen.findByText("my-s3")).toBeInTheDocument()
    expect(screen.getByText("s3")).toBeInTheDocument()
  })

  it("adds an S3 storage backend with its config fields", async () => {
    const { calls } = mockApi({
      "GET /api/v1/storage": [],
      "POST /api/v1/storage": { status: "added" },
    })
    renderWithProviders(<StoragePage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: /add storage/i }))
    await user.type(await screen.findByLabelText(/^name/i), "backups-s3")
    await user.type(screen.getByLabelText(/bucket/i), "my-bucket")
    await user.type(screen.getByLabelText(/region/i), "us-east-1")
    await user.type(screen.getByLabelText(/access key/i), "AKIA123")
    await user.type(screen.getByLabelText(/secret key/i), "shhh")
    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      const call = calls.find(
        (c) => c.method === "POST" && c.path === "/api/v1/storage",
      )
      expect(call?.body).toEqual({
        name: "backups-s3",
        driver: "s3",
        config: {
          bucket: "my-bucket",
          region: "us-east-1",
          access_key: "AKIA123",
          secret_key: "shhh",
        },
      })
    })
  })
})
