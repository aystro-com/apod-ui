import type { ReactNode } from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AuthProvider } from "@/lib/auth"
import { seedSession } from "@/test/utils"
import { useSiteEventStream } from "./use-site-stream"

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}

/** A fetch Response whose body streams the given events as SSE `data:` frames. */
function sseResponse(events: object[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      for (const ev of events) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe("useSiteEventStream", () => {
  it("streams and accumulates events while active", async () => {
    seedSession("admin")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          { step: "Copying files & data", status: "running", percent: 45, time: "" },
          { step: "Cloned", status: "done", percent: 100, time: "" },
        ]),
      ),
    )

    const { result } = renderHook(() => useSiteEventStream("ex.com", true), {
      wrapper,
    })

    await waitFor(() => expect(result.current).toHaveLength(2))
    expect(result.current[0].step).toBe("Copying files & data")
    expect(result.current[1].status).toBe("done")
  })

  it("normalizes malformed events (missing step / non-numeric percent)", async () => {
    seedSession("admin")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        // step missing; percent is a non-numeric string → would be NaN downstream.
        sseResponse([{ status: "running", percent: "oops" }]),
      ),
    )

    const { result } = renderHook(() => useSiteEventStream("ex.com", true), {
      wrapper,
    })

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current[0].percent).toBe(0)
    expect(result.current[0].step).toBeTruthy()
    expect(Number.isFinite(result.current[0].percent)).toBe(true)
  })

  it("does not open a stream while inactive", () => {
    seedSession("admin")
    const fetchSpy = vi.fn(async () => sseResponse([]))
    vi.stubGlobal("fetch", fetchSpy)

    const { result } = renderHook(() => useSiteEventStream("ex.com", false), {
      wrapper,
    })

    expect(result.current).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("clears accumulated events when it goes inactive", async () => {
    seedSession("admin")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          { step: "Restoring", status: "running", percent: 30, time: "" },
        ]),
      ),
    )

    const { result, rerender } = renderHook(
      ({ active }) => useSiteEventStream("ex.com", active),
      { wrapper, initialProps: { active: true } },
    )

    await waitFor(() => expect(result.current).toHaveLength(1))

    rerender({ active: false })
    await waitFor(() => expect(result.current).toEqual([]))
  })
})
