import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { toastManager } from "@/components/ui/toast"
import { useAction } from "./use-action"

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe("useAction", () => {
  it("invalidates the given query keys and toasts on success", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    const invalidate = vi.spyOn(client, "invalidateQueries")
    const toast = vi.spyOn(toastManager, "add").mockImplementation(() => "id")
    const onSuccess = vi.fn()

    const { result } = renderHook(
      () =>
        useAction({
          fn: async (n: number) => n * 2,
          invalidates: [["sites"], ["activity"]],
          successTitle: "Done",
          onSuccess,
        }),
      { wrapper: wrapper(client) },
    )

    await act(async () => {
      await result.current.mutateAsync(21)
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["sites"] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["activity"] })
    expect(toast).toHaveBeenCalledWith({ title: "Done", type: "success" })
    expect(onSuccess).toHaveBeenCalledWith(42, 21)
  })

  it("toasts the error message on failure and does not invalidate", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    const invalidate = vi.spyOn(client, "invalidateQueries")
    const toast = vi.spyOn(toastManager, "add").mockImplementation(() => "id")

    const { result } = renderHook(
      () =>
        useAction({
          fn: async () => {
            throw new Error("nope")
          },
          invalidates: [["sites"]],
          successTitle: "Done",
        }),
      { wrapper: wrapper(client) },
    )

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow("nope")
    })

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: "Action failed",
        description: "nope",
        type: "error",
      }),
    )
    expect(invalidate).not.toHaveBeenCalled()
  })
})
