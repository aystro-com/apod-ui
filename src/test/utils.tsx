import type { ReactElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { render } from "@testing-library/react"
import { afterEach, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/lib/auth"

export const TEST_BASE = "https://apod.test:8443"
export const TEST_KEY = "apod_testkey123"

/** Handler value: static data or a function of the parsed request body. */
export type RouteHandler =
  | unknown
  | ((body: unknown, url: URL) => unknown)

export interface MockRoute {
  data?: RouteHandler
  status?: number
  error?: string
}

// A permanent fetch replacement that delegates to the current test's handler.
// Plain function (not vi.fn) so mock restoration never detaches it; stray
// late requests after a test resolve against a benign 404 envelope instead of
// hitting the real network.
type FetchHandler = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

let currentHandler: FetchHandler | null = null

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  if (currentHandler) return currentHandler(input, init)
  return Promise.resolve(
    new Response(JSON.stringify({ ok: false, error: "no fetch mock installed" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }),
  )
}) as typeof fetch

afterEach(() => {
  currentHandler = null
})

/**
 * Installs an apod-style fetch handler: routes are keyed by
 * "METHOD /api/v1/path" and responses are wrapped in { ok, data } envelopes.
 * Returns a spy plus a call log for asserting request bodies.
 */
export function mockApi(routes: Record<string, MockRoute | RouteHandler>) {
  const calls: Array<{ method: string; path: string; body: unknown }> = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), TEST_BASE)
    const method = (init?.method ?? "GET").toUpperCase()
    const key = `${method} ${url.pathname}`
    let body: unknown
    if (init?.body) {
      try {
        body = JSON.parse(String(init.body))
      } catch {
        body = init.body
      }
    }
    calls.push({ method, path: url.pathname, body })

    const route = routes[key]
    if (route === undefined) {
      return new Response(
        JSON.stringify({ ok: false, error: `no mock for ${key}` }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      )
    }

    // Only treat objects as MockRoute when they look like one — `status` must
    // be a numeric HTTP code, otherwise it's plain response data (the apod API
    // returns payloads like { status: "deleted" }).
    const isMockRoute =
      route !== null &&
      typeof route === "object" &&
      !Array.isArray(route) &&
      ("data" in route ||
        ("status" in route && typeof (route as MockRoute).status === "number") ||
        ("error" in route && typeof (route as MockRoute).error === "string"))

    if (isMockRoute) {
      const r = route as MockRoute
      if (r.error || (r.status && r.status >= 400)) {
        return new Response(
          JSON.stringify({ ok: false, error: r.error ?? "error" }),
          { status: r.status ?? 500, headers: { "Content-Type": "application/json" } },
        )
      }
      const data = typeof r.data === "function" ? r.data(body, url) : r.data
      return new Response(JSON.stringify({ ok: true, data }), {
        status: r.status ?? 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const data = typeof route === "function" ? route(body, url) : route
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  })

  currentHandler = fetchMock
  return { fetchMock, calls }
}

export function seedSession(role: "admin" | "user" = "admin") {
  sessionStorage.setItem(
    "apod.connection",
    JSON.stringify({ baseUrl: TEST_BASE, apiKey: TEST_KEY, role }),
  )
}

// Stop background refetches/retries from leaking past the end of each test.
// This hook runs before the global cleanup in setup.ts (LIFO), so pending
// mutation chains and invalidation refetches settle against the still-stubbed
// fetch instead of rejecting after the mock is restored.
const activeClients: QueryClient[] = []
afterEach(async () => {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  for (const client of activeClients) client.clear()
  activeClients.length = 0
})

export function renderWithProviders(
  ui: ReactElement,
  {
    route = "/",
    // TanStack Router path pattern(s) the UI is mounted at,
    // e.g. ["/sites/$domain", "/sites/$domain/$"].
    path = "/" as string | string[],
    role = "admin" as "admin" | "user",
  } = {},
) {
  seedSession(role)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  activeClients.push(queryClient)

  const rootRoute = createRootRoute()
  const paths = Array.isArray(path) ? path : [path]
  const children = paths.map((p) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: p,
      component: () => ui,
    }),
  )
  // Catch-all so in-test navigation (e.g. after destroying a site) never 404s.
  if (!paths.includes("$")) {
    children.push(
      createRoute({
        getParentRoute: () => rootRoute,
        path: "$",
        component: () => ui,
      }),
    )
  }
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: [route] }),
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- test router is intentionally untyped */}
          <RouterProvider router={router as any} />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

export function makeSite(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    domain: "example.com",
    driver: "php",
    status: "running",
    ram: "512M",
    cpu: "1",
    storage: "5G",
    env: "{}",
    repo: "",
    branch: "",
    owner: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}
