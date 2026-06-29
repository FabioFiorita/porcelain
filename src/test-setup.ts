import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Globals are off (tests import from 'vitest'), so testing-library's auto-cleanup
// never registers — unmount every render between tests by hand.
afterEach(() => {
  cleanup()
})

// jsdom's window.localStorage is intermittently undefined at module-import time
// under parallel test files. zustand's persist middleware captures
// `window.localStorage` ONCE (createJSONStorage(() => window.localStorage)) when a
// persisted store first loads — so an undefined capture makes every later setState
// crash with `Cannot read properties of undefined (reading 'setItem')`. Install a
// deterministic in-memory Storage before any store module imports. setupFiles run
// before the test module graph, so the capture always sees this.
if (typeof window.localStorage?.setItem !== 'function') {
  const store = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key)
    },
    setItem: (key, value) => {
      store.set(key, String(value))
    },
  }
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: memoryStorage,
  })
}

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
