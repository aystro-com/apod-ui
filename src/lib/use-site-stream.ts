import { useEffect, useState } from "react"
import type { DeployEvent } from "@/lib/api"
import { useApi } from "@/lib/auth"

/**
 * Subscribes to a site's live operation progress stream while `active` is true,
 * accumulating events for rendering. The single source of truth for showing
 * what a site is doing — deploy, update, clone, destroy, backup, restore — so
 * call sites don't each re-implement fetch + AbortController plumbing.
 *
 * The stream is always torn down on unmount or when `active` flips false: a
 * leaked SSE response holds a browser connection (HTTP/1.1 allows only ~6 per
 * host), which can stall later requests until it times out server-side.
 */
export function useSiteEventStream(
  domain: string,
  active: boolean,
): DeployEvent[] {
  const { api } = useApi()
  const [events, setEvents] = useState<DeployEvent[]>([])

  useEffect(() => {
    if (!active || !domain) return
    const controller = new AbortController()
    void api.streamDeployEvents(
      domain,
      (ev) => setEvents((prev) => [...prev, ev]),
      controller.signal,
    )
    // Reset on teardown (deactivation / domain change / unmount) so the next
    // active period starts from an empty list rather than a prior operation's
    // steps.
    return () => {
      controller.abort()
      setEvents([])
    }
  }, [api, domain, active])

  return events
}
