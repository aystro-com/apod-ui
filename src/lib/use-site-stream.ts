import { useEffect, useState } from "react"
import { appendDeployEvent, type DeployEvent } from "@/lib/api"
import { useApi } from "@/lib/auth"

/** Upper bound on retained stream events — far more than any real operation. */
const MAX_STREAM_EVENTS = 500

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
      // Cap the retained events so a long-running or misbehaving server stream
      // can't grow this array (and its O(n) re-render cost) without bound, and
      // drop a prior operation's replayed events when a new run begins.
      (ev) =>
        setEvents((prev) => appendDeployEvent(prev, ev, MAX_STREAM_EVENTS)),
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
