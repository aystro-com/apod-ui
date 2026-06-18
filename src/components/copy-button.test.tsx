import { fireEvent, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { renderWithProviders } from "@/test/utils"
import { CopyButton } from "./copy-button"

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  })
  return writeText
}

describe("CopyButton", () => {
  it("writes the value to the clipboard and flips to a copied state", async () => {
    const writeText = stubClipboard()
    renderWithProviders(<CopyButton value="secret-token" label="Copy token" />)

    const button = await screen.findByRole("button", { name: "Copy token" })
    fireEvent.click(button)

    expect(writeText).toHaveBeenCalledWith("secret-token")
    // The icon swaps to the success check after a successful copy.
    await waitFor(() =>
      expect(button.querySelector(".text-success")).not.toBeNull(),
    )
  })

  it("does nothing for an empty value", async () => {
    const writeText = stubClipboard()
    renderWithProviders(<CopyButton value="" />)

    fireEvent.click(await screen.findByRole("button", { name: "Copy" }))

    expect(writeText).not.toHaveBeenCalled()
  })
})
