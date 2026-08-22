import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Globals are off (tests import from 'vitest'), so testing-library's auto-cleanup
// never registers — unmount every render between tests by hand.
afterEach(() => {
  cleanup()
})

// Backend suites opt into `@vitest-environment node` (no `window`); the DOM stubs
// below are jsdom-only, so skip them there — this file must stay environment-safe
// now that a node-env tier exists (daemon-http.test.ts / session.test.ts).
if (typeof window !== 'undefined') {
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
      get length(): number {
        return store.size
      },
      clear: (): void => store.clear(),
      getItem: (key: string): string | null => store.get(key) ?? null,
      key: (index: number): string | null => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string): void => {
        store.delete(key)
      },
      setItem: (key: string, value: string): void => {
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

  // jsdom ships no ResizeObserver. The only stub for it — cmdk, Base UI's Collapsible
  // and VirtualRows (measuring wrapped row heights, publishing `--vrows-vw`) all reach
  // for it. jsdom lays nothing out, so a stub that never fires is the honest answer:
  // the callback would only ever report zeroes. Layout is proved in a browser.
  if (typeof window.ResizeObserver !== 'function') {
    window.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
    globalThis.ResizeObserver = window.ResizeObserver
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
}
