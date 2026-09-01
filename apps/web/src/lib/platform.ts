/**
 * The one browser-vs-shell seam. Porcelain's renderer ships as BOTH the Electron
 * app's window (the preload injects `window.porcelain` — the shell bridge) and,
 * a plain browser client the daemon serves at `/`
 * (no preload, so `window.porcelain` is undefined). Everything that only exists
 * shell-side — the shell tRPC router (updater/skills/reveal/new-window),
 * `windowInit`, the shell-event push channel — keys off this flag.
 *
 * Unlike lib/trpc and lib/daemon, components MAY import this: it's a plain
 * boolean, not a transport, so the Biome lint fence doesn't apply.
 *
 * vitest/jsdom note: unit tests also lack the bridge, so `isBrowser` is `true`
 * under test. That's fine — the shell hooks are mocked in every test that touches
 * them, so nothing reaches the shell router through this flag.
 */
export const isBrowser = typeof window !== 'undefined' && window.porcelain === undefined

/**
 * True in the Electron shell on Linux (or forced-Linux) desktop: the preload IS present
 * (`isBrowser` is false) but `window.porcelain.platform` is 'linux' — wants Ctrl as the
 * primary modifier like the browser client, but desktop-Linux word labels (Ctrl+Shift+F)
 * instead of glyphs. Keyboard and main.tsx fan out from here.
 *
 * vitest/jsdom: no bridge, so this is `false` under test (browser default stays baseline).
 */
export const isLinuxShell = typeof window !== 'undefined' && window.porcelain?.platform === 'linux'

/**
 * True in the Electron shell on macOS: the OS draws native traffic lights at a fixed
 * window position (see `trafficLightPosition` in `apps/desktop/src/main/window.ts`)
 * regardless of what the renderer paints underneath. Whichever chrome reaches the
 * window's true top-left corner — the sidebar header, or the Viewer header once that
 * sidebar collapses — must reserve space for them itself.
 *
 * Keyed off `'darwin'` directly rather than `!isLinuxShell`: a Windows shell is neither
 * Linux nor macOS, and inheriting the macOS answer there would reserve 80px for traffic
 * lights that do not exist.
 *
 * vitest/jsdom: no bridge, so this is `false` under test.
 */
export const isMacShell = typeof window !== 'undefined' && window.porcelain?.platform === 'darwin'

/**
 * True in the Electron shell wherever `createWindow` asks for `frame: false` — Linux and
 * Windows, i.e. every desktop platform except macOS (`window.ts`). Those windows have no
 * OS-drawn chrome at all, so the renderer supplies both halves itself: the drag region and
 * the min/maximize/close cluster (`title-bar.tsx` → `window-controls.tsx`). macOS keeps its
 * native traffic lights and the browser client has no window to move, so neither draws the
 * row and both start at the window's true top.
 *
 * Distinct from `isLinuxShell`, which answers a keyboard question (Ctrl-primary, word
 * labels), not a window-chrome one.
 *
 * vitest/jsdom: no bridge, so this is `false` under test.
 */
export const isFramelessShell = !isBrowser && !isMacShell

/**
 * True under the Playwright e2e harness, in EITHER runtime: the Electron shell (preload
 * sets `porcelain.e2e`) or the browser client (the harness plants a localStorage flag via
 * addInitScript). Gates test-only affordances (terminal buffer hook, skills-toast
 * suppression); harmless if a user sets the flag by hand.
 *
 * vitest/jsdom: `false` under test (localStorage returns null).
 */
export const isE2E =
  typeof window !== 'undefined' &&
  (window.porcelain?.e2e === true || window.localStorage.getItem('porcelain-e2e') === '1')

/**
 * True on a multi-touch device (iPad/iPhone Safari, touch laptops) — "a finger is the
 * pointer here", not "this is a phone" (an iPad is coarse-touch at desktop width; see
 * `useIsMobile`). Drives terminal behavior: force the DOM paint path (WebGL is evicted
 * under memory pressure on Apple devices), convert touch pans into `scrollLines` (iOS
 * Safari fires no wheel events), and skip auto-focus on mount (it would raise the
 * keyboard) — a function, not a const, so tests can stub `navigator` at call time.
 */
export function isCoarseTouch(): boolean {
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1
}
