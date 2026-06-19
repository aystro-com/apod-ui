import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toastManager } from "@/components/ui/toast"

/**
 * useMutation wrapper with the app's standard behavior: invalidate the given
 * query keys and toast on success/error.
 */
export function useAction<TVariables = void, TData = unknown>(options: {
  fn: (vars: TVariables) => Promise<TData>
  invalidates?: Array<readonly unknown[]>
  successTitle?: string
  // Runs the instant the action starts, before the request resolves — e.g. to
  // flip a busy banner without waiting for the next poll.
  onMutate?: (vars: TVariables) => void
  onSuccess?: (data: TData, vars: TVariables) => void
  // Return true to suppress the default "Action failed" toast for this error
  // (e.g. an expected 2FA-required response that the UI handles inline).
  suppressErrorToast?: (err: unknown) => boolean
}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: options.fn,
    onMutate: options.onMutate,
    onSuccess: (data, vars) => {
      for (const key of options.invalidates ?? []) {
        queryClient.invalidateQueries({ queryKey: key as unknown[] })
      }
      if (options.successTitle) {
        toastManager.add({ title: options.successTitle, type: "success" })
      }
      options.onSuccess?.(data, vars)
    },
    onError: (err) => {
      if (options.suppressErrorToast?.(err)) return
      toastManager.add({
        title: "Action failed",
        description: err instanceof Error ? err.message : undefined,
        type: "error",
      })
    },
  })
}
