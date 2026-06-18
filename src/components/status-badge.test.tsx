import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StatusBadge } from "./status-badge"

describe("StatusBadge", () => {
  it("lowercases the status and renders it", () => {
    render(<StatusBadge status="RUNNING" />)
    expect(screen.getByText("running")).toBeInTheDocument()
  })

  it("falls back to 'unknown' for an empty status", () => {
    render(<StatusBadge status="" />)
    expect(screen.getByText("unknown")).toBeInTheDocument()
  })

  it("animates the dot only for live statuses (running/up)", () => {
    const { container, rerender } = render(<StatusBadge status="running" />)
    expect(container.querySelector(".animate-pulse")).not.toBeNull()

    rerender(<StatusBadge status="up" />)
    expect(container.querySelector(".animate-pulse")).not.toBeNull()

    rerender(<StatusBadge status="stopped" />)
    expect(container.querySelector(".animate-pulse")).toBeNull()
  })

  it("maps known states to their semantic style without crashing on unknown ones", () => {
    const { container, rerender } = render(<StatusBadge status="failed" />)
    expect(container.querySelector(".text-destructive-foreground")).not.toBeNull()

    // An unrecognised status still renders (no style class, but no throw).
    rerender(<StatusBadge status="quiescing" />)
    expect(screen.getByText("quiescing")).toBeInTheDocument()
  })
})
