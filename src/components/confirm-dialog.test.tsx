import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { mockApi, renderWithProviders } from "@/test/utils"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "./confirm-dialog"

describe("ConfirmDialog", () => {
  it("runs the action on confirm without type-to-confirm", async () => {
    mockApi({})
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <ConfirmDialog
        trigger={<Button>Open</Button>}
        title="Remove thing"
        description="Are you sure?"
        confirmLabel="Remove"
        onConfirm={onConfirm}
      />,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "Open" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Remove" }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it("disables confirm until the exact value is typed", async () => {
    mockApi({})
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <ConfirmDialog
        trigger={<Button>Open</Button>}
        title="Destroy"
        description="dangerous"
        confirmLabel="Destroy"
        typeToConfirm="prod.example.com"
        onConfirm={onConfirm}
      />,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "Open" }))
    const dialog = await screen.findByRole("alertdialog")
    const confirm = within(dialog).getByRole("button", { name: "Destroy" })

    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByRole("textbox"), "prod.example")
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByRole("textbox"), ".com")
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it("keeps the dialog open when the action fails", async () => {
    mockApi({})
    const onConfirm = vi.fn().mockRejectedValue(new Error("nope"))
    renderWithProviders(
      <ConfirmDialog
        trigger={<Button>Open</Button>}
        title="Remove thing"
        description="Are you sure?"
        confirmLabel="Remove"
        onConfirm={onConfirm}
      />,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "Open" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Remove" }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce())
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("cancel closes without running the action", async () => {
    mockApi({})
    const onConfirm = vi.fn()
    renderWithProviders(
      <ConfirmDialog
        trigger={<Button>Open</Button>}
        title="Remove thing"
        description="Are you sure?"
        onConfirm={onConfirm}
      />,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "Open" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
