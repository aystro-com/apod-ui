import "@testing-library/jest-dom/vitest"
import { afterEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"
import { unmountToaster } from "gooey-toast"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  sessionStorage.clear()
  localStorage.clear()
  // gooey-toast lazily mounts its own node on document.body when a toast fires
  // and survives React's cleanup; tear it down so a toast from one test can't
  // leak into the next (e.g. a "Saved" toast colliding with a "Save" button).
  unmountToaster()
})

// jsdom is missing a few browser APIs that Base UI and the app rely on.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

if (!window.ResizeObserver) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}
