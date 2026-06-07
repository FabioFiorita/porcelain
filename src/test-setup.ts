import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Globals are off (tests import from 'vitest'), so testing-library's auto-cleanup
// never registers — unmount every render between tests by hand.
afterEach(() => {
  cleanup()
})

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
