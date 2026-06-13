import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Globals are off (tests import from 'vitest'), so testing-library's auto-cleanup
// never registers — unmount every render between tests by hand.
afterEach(() => {
  cleanup()
})

// jsdom ships no elementFromPoint; ProseMirror (the notes-card TipTap editor)
// calls it during placeholder viewport tracking on mount. Returning null is the
// "no element here" answer ProseMirror already handles gracefully.
if (typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = (): null => null
}

// jsdom ships no matchMedia; shadcn's SidebarProvider (and any responsive
// primitive) calls it on mount, so stub it once for every component test.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })
}
