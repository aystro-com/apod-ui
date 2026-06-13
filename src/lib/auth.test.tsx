import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { mockApi, TEST_BASE, TEST_KEY } from "@/test/utils"
import { AuthProvider, useAuth } from "./auth"

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

const keyCreds = { kind: "key" as const, apiKey: TEST_KEY }
const passwordCreds = {
  kind: "password" as const,
  name: "alice",
  password: "long-password",
}

describe("AuthProvider — API key login", () => {
  it("starts signed out with no stored session", () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.session).toBeNull()
    expect(result.current.api).toBeNull()
  })

  it("rejects non-http(s) server URLs without any request", async () => {
    const { fetchMock } = mockApi({})
    const { result } = renderHook(() => useAuth(), { wrapper })
    await expect(
      result.current.connect("ftp://example.com", keyCreds, false),
    ).rejects.toThrow(/http/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uses /auth/me for role detection when available", async () => {
    const { calls } = mockApi({
      "GET /api/v1/sites": [],
      "GET /api/v1/auth/me": { name: "root", role: "admin" },
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(() => result.current.connect(TEST_BASE, keyCreds, false))
    expect(result.current.session).toMatchObject({ role: "admin", name: "root" })
    // The legacy admin probe must not run when /auth/me works.
    expect(calls.some((c) => c.path === "/api/v1/server-stats")).toBe(false)
  })

  it("falls back to the server-stats probe on older servers without /auth/me", async () => {
    mockApi({
      "GET /api/v1/sites": [],
      "GET /api/v1/auth/me": { status: 404, error: "not found" },
      "GET /api/v1/server-stats": { status: 403, error: "admin only" },
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(() => result.current.connect(TEST_BASE, keyCreds, false))
    expect(result.current.session).toMatchObject({ role: "user" })
  })

  it("fails to connect with an invalid key", async () => {
    mockApi({
      "GET /api/v1/sites": { status: 401, error: "invalid API key" },
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await expect(
      result.current.connect(TEST_BASE, keyCreds, false),
    ).rejects.toMatchObject({ status: 401 })
    expect(result.current.session).toBeNull()
  })
})

describe("AuthProvider — password login", () => {
  it("exchanges name+password for a session token", async () => {
    const { calls } = mockApi({
      "POST /api/v1/auth/login": {
        token: "apod_sess_abc123",
        user: { name: "alice", role: "user" },
      },
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(() => result.current.connect(TEST_BASE, passwordCreds, false))
    expect(result.current.session).toMatchObject({
      role: "user",
      name: "alice",
      kind: "session",
    })
    const login = calls.find((c) => c.path === "/api/v1/auth/login")
    expect(login?.body).toEqual({ name: "alice", password: "long-password" })
    // The session token (not the password) is what gets stored.
    expect(sessionStorage.getItem("apod.connection")).toContain("apod_sess_abc123")
    expect(sessionStorage.getItem("apod.connection")).not.toContain("long-password")
  })

  it("surfaces login failures", async () => {
    mockApi({
      "POST /api/v1/auth/login": {
        status: 401,
        error: "invalid username or password",
      },
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await expect(
      result.current.connect(TEST_BASE, passwordCreds, false),
    ).rejects.toThrow(/invalid username or password/)
    expect(result.current.session).toBeNull()
  })

  it("disconnect revokes the session server-side", async () => {
    const { calls } = mockApi({
      "POST /api/v1/auth/login": {
        token: "apod_sess_abc123",
        user: { name: "alice", role: "user" },
      },
      "POST /api/v1/auth/logout": { status: "logged_out" },
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(() => result.current.connect(TEST_BASE, passwordCreds, false))
    await act(async () => {
      result.current.disconnect()
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(result.current.session).toBeNull()
    expect(calls.some((c) => c.path === "/api/v1/auth/logout")).toBe(true)
  })
})

describe("AuthProvider — persistence", () => {
  it("uses localStorage when remember is set", async () => {
    mockApi({
      "GET /api/v1/sites": [],
      "GET /api/v1/auth/me": { name: "root", role: "admin" },
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(() => result.current.connect(TEST_BASE, keyCreds, true))
    expect(localStorage.getItem("apod.connection")).toContain(TEST_KEY)
  })

  it("restores a stored session on mount", () => {
    sessionStorage.setItem(
      "apod.connection",
      JSON.stringify({
        baseUrl: TEST_BASE,
        token: TEST_KEY,
        kind: "key",
        role: "admin",
        name: "root",
      }),
    )
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.session).toMatchObject({ role: "admin" })
    expect(result.current.api).not.toBeNull()
  })

  it("migrates legacy stored sessions that used apiKey", () => {
    sessionStorage.setItem(
      "apod.connection",
      JSON.stringify({ baseUrl: TEST_BASE, apiKey: TEST_KEY, role: "admin" }),
    )
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.session).toMatchObject({ role: "admin", kind: "key" })
  })
})
