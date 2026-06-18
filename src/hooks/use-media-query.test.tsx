import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useIsMobile, useMediaQuery } from "./use-media-query"

// Capture the media-query string the hook resolves and control `matches`.
function spyMatchMedia(matches = false) {
  const seen: string[] = []
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => {
    seen.push(q)
    return {
      matches,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
  })
  return seen
}

afterEach(() => vi.restoreAllMocks())

describe("useMediaQuery", () => {
  it("resolves a named min-width breakpoint", () => {
    const seen = spyMatchMedia()
    renderHook(() => useMediaQuery("lg"))
    expect(seen).toContain("(min-width: 1024px)")
  })

  it("resolves a max-* breakpoint to one pixel below", () => {
    const seen = spyMatchMedia()
    renderHook(() => useMediaQuery("max-md"))
    expect(seen).toContain("(max-width: 799px)")
  })

  it("combines a min and max range with 'and'", () => {
    const seen = spyMatchMedia()
    renderHook(() => useMediaQuery("sm:max-lg"))
    expect(seen).toContain("(min-width: 640px) and (max-width: 1023px)")
  })

  it("passes a raw parenthesised query through untouched", () => {
    const seen = spyMatchMedia()
    renderHook(() => useMediaQuery("(orientation: portrait)"))
    expect(seen).toContain("(orientation: portrait)")
  })

  it("builds a query from an object input including pointer", () => {
    const seen = spyMatchMedia()
    renderHook(() => useMediaQuery({ min: 640, pointer: "coarse" }))
    expect(seen).toContain("(min-width: 640px) and (pointer: coarse)")
  })

  it("returns the matchMedia result", () => {
    spyMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery("lg"))
    expect(result.current).toBe(true)
  })
})

describe("useIsMobile", () => {
  it("queries max-md", () => {
    const seen = spyMatchMedia()
    renderHook(() => useIsMobile())
    expect(seen).toContain("(max-width: 799px)")
  })
})
