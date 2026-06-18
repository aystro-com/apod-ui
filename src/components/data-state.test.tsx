import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Button } from "@/components/ui/button"
import { EmptyState, ErrorState, LoadingRows } from "./data-state"

describe("LoadingRows", () => {
  it("renders the requested number of skeleton rows", () => {
    const { container } = render(<LoadingRows rows={5} />)
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(5)
  })

  it("defaults to three rows", () => {
    const { container } = render(<LoadingRows />)
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
  })
})

describe("ErrorState", () => {
  it("surfaces an Error's message", () => {
    render(<ErrorState error={new Error("boom")} />)
    expect(screen.getByText("boom")).toBeInTheDocument()
  })

  it("shows a generic message for non-Error values", () => {
    render(<ErrorState error="just a string" />)
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument()
  })
})

describe("EmptyState", () => {
  it("renders title, optional description and action", () => {
    render(
      <EmptyState
        title="No sites yet"
        description="Create your first site"
        action={<Button>New site</Button>}
      />,
    )
    expect(screen.getByText("No sites yet")).toBeInTheDocument()
    expect(screen.getByText("Create your first site")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New site" })).toBeInTheDocument()
  })

  it("omits the description when not provided", () => {
    render(<EmptyState title="Nothing here" />)
    expect(screen.getByText("Nothing here")).toBeInTheDocument()
  })
})
