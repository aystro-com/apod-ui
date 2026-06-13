import { describe, expect, it, vi } from "vitest"
import { mockApi, TEST_BASE, TEST_KEY } from "@/test/utils"
import { ApiClient, ApiError } from "./api"

function client(onUnauthorized?: () => void) {
  return new ApiClient({ baseUrl: TEST_BASE, apiKey: TEST_KEY, onUnauthorized })
}

describe("ApiClient", () => {
  it("sends the API key as a Bearer token and unwraps the envelope", async () => {
    const { fetchMock } = mockApi({ "GET /api/v1/sites": [{ domain: "a.com" }] })
    const sites = await client().listSites()
    expect(sites).toEqual([{ domain: "a.com" }])
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${TEST_BASE}/api/v1/sites`)
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TEST_KEY}`,
    )
  })

  it("strips trailing slashes from the base URL", async () => {
    mockApi({ "GET /api/v1/sites": [] })
    const c = new ApiClient({ baseUrl: TEST_BASE + "///", apiKey: TEST_KEY })
    await expect(c.listSites()).resolves.toEqual([])
  })

  it("URL-encodes domains in paths", async () => {
    const { calls } = mockApi({
      "GET /api/v1/sites/weird%20domain": { domain: "weird domain" },
    })
    await client().getSite("weird domain")
    expect(calls[0].path).toBe("/api/v1/sites/weird%20domain")
  })

  it("throws ApiError with the server's message on failure", async () => {
    mockApi({
      "GET /api/v1/sites": { status: 500, error: "database locked" },
    })
    await expect(client().listSites()).rejects.toThrow("database locked")
  })

  it("invokes onUnauthorized and throws on 401", async () => {
    const onUnauthorized = vi.fn()
    mockApi({ "GET /api/v1/sites": { status: 401, error: "API key required" } })
    await expect(client(onUnauthorized).listSites()).rejects.toMatchObject({
      status: 401,
    })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it("maps 429 to a friendly rate-limit error", async () => {
    mockApi({ "GET /api/v1/sites": { status: 429, error: "slow down" } })
    await expect(client().listSites()).rejects.toThrow(/rate limit/i)
  })

  it("maps network failures to status 0", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("boom"))
    const err = await client()
      .listSites()
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(0)
  })

  it("sends JSON bodies for writes", async () => {
    const { calls } = mockApi({
      "POST /api/v1/sites/a.com/env": { status: 200, data: {} },
    })
    await client().setEnv("a.com", "KEY", "value")
    expect(calls[0].body).toEqual({ key: "KEY", value: "value" })
  })

  it("appends ?purge=true only when purging", async () => {
    const seen: string[] = []
    const { fetchMock } = mockApi({
      "DELETE /api/v1/sites/a.com": {},
    })
    await client().destroySite("a.com", false)
    await client().destroySite("a.com", true)
    for (const call of fetchMock.mock.calls) {
      seen.push(String(call[0]))
    }
    expect(seen[0]).not.toContain("purge")
    expect(seen[1]).toContain("?purge=true")
  })
})
