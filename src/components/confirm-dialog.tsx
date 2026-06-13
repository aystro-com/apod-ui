import { useState, type ReactElement, type ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"

interface ConfirmDialogProps {
  trigger: ReactElement<Record<string, unknown>>
  title: string
  description: ReactNode
  confirmLabel?: string
  /** When set, the user must type this exact value to enable the confirm button. */
  typeToConfirm?: string
  destructive?: boolean
  onConfirm: () => Promise<unknown> | void
}

/**
 * Guard rail for destructive or irreversible operations. Optionally requires
 * typing the resource name (GitHub-style) before the action can run.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  typeToConfirm,
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)

  const ready = !typeToConfirm || typed === typeToConfirm

  async function handleConfirm() {
    if (!ready || busy) return
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
      setTyped("")
    } catch {
      // Errors are surfaced by the caller (toast); keep the dialog open so
      // the user can retry or cancel.
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setTyped("")
      }}
    >
      <AlertDialogTrigger render={trigger} />
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {typeToConfirm && (
          <div className="flex flex-col gap-2 px-6 pb-2">
            <Label htmlFor="confirm-input" className="text-sm">
              Type <span className="font-mono font-semibold">{typeToConfirm}</span> to
              confirm
            </Label>
            <Input
              id="confirm-input"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>
            Cancel
          </AlertDialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!ready || busy}
            onClick={handleConfirm}
          >
            {busy && <Spinner className="size-4" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  )
}
