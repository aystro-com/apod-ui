import { describe, expect, it } from "vitest"
import { formatBytes, formatDate, formatMB, shortHash, timeAgo } from "./format"

describe("formatBytes", () => {
  it("formats plain bytes", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(512)).toBe("512 B")
  })

  it("scales through KB, MB, GB, TB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB")
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB")
    expect(formatBytes(5 * 1024 ** 3)).toBe("5.0 GB")
    expect(formatBytes(2 * 1024 ** 4)).toBe("2.0 TB")
  })

  it("drops the decimal for values >= 100", () => {
    expect(formatBytes(150 * 1024)).toBe("150 KB")
  })

  it("handles invalid input", () => {
    expect(formatBytes(-1)).toBe("—")
    expect(formatBytes(Number.NaN)).toBe("—")
  })
})

describe("formatMB", () => {
  it("treats the input as megabytes", () => {
    expect(formatMB(1)).toBe("1.0 MB")
    expect(formatMB(1024)).toBe("1.0 GB")
  })
})

describe("formatDate", () => {
  it("returns the raw string for unparseable dates", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date")
  })

  it("formats valid ISO dates", () => {
    expect(formatDate("2026-01-15T12:30:00Z")).toMatch(/2026/)
  })
})

describe("timeAgo", () => {
  it("says 'just now' for very recent times", () => {
    expect(timeAgo(new Date().toISOString())).toBe("just now")
  })

  it("pluralizes correctly", () => {
    const twoHours = new Date(Date.now() - 2 * 3600_000).toISOString()
    expect(timeAgo(twoHours)).toBe("2 hours ago")
    const oneDay = new Date(Date.now() - 25 * 3600_000).toISOString()
    expect(timeAgo(oneDay)).toBe("1 day ago")
  })
})

describe("shortHash", () => {
  it("truncates to 7 characters", () => {
    expect(shortHash("abcdef1234567890")).toBe("abcdef1")
  })

  it("handles empty hashes", () => {
    expect(shortHash("")).toBe("—")
  })
})
