import { useEffect } from "react"
import {
  mountToaster,
  toast as gooey,
  unmountToaster,
} from "gooey-toast"
import "gooey-toast/styles.css"

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"

type ToastType = "success" | "error" | "warning" | "info" | "loading"

export interface ToastInput {
  title?: string
  description?: string
  /** Visual intent; defaults to a neutral "info" toast. */
  type?: ToastType
  /** Auto-dismiss after N ms, or null to keep it until dismissed. */
  duration?: number | null
}

/**
 * App-wide toast entrypoint, backed by gooey-toast's morphing notifications.
 *
 * Kept as a `{ add, close }` object so the (many) existing call sites —
 * `toastManager.add({ title, description, type })` — work unchanged after the
 * swap from the previous Base UI implementation.
 */
export const toastManager = {
  add(input: ToastInput): string {
    const { type = "info", title, description, duration } = input
    const opts = { title, description, duration }
    switch (type) {
      case "success":
        return gooey.success(opts)
      case "error":
        return gooey.error(opts)
      case "warning":
        return gooey.warning(opts)
      case "loading":
        // gooey-toast has no standalone "loading" intent; a neutral toast with
        // its spinner-less info styling is the closest match for our few uses.
        return gooey.info(opts)
      default:
        return gooey.info(opts)
    }
  },
  close(id: string): void {
    gooey.dismiss(id)
  },
}

export interface ToastProviderProps {
  position?: ToastPosition
}

/**
 * Mounts the single gooey-toast root for the app. Rendered once near the tree
 * root; it draws nothing itself (gooey manages its own portal).
 */
export function ToastProvider({
  position = "bottom-right",
}: ToastProviderProps): null {
  useEffect(() => {
    mountToaster({ position })
    return () => unmountToaster()
  }, [position])
  return null
}
