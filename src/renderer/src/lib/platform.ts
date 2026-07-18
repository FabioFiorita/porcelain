/**
 * The one browser-vs-shell seam. Porcelain's renderer ships as BOTH the Electron
 * app's window (the preload injects `window.porcelain` — the shell bridge) and,
 * since remote-envs Phase 3, a plain browser client the daemon serves at `/`
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
 * True in the Electron shell running on a Linux (or forced-Linux) desktop — the
 * preload IS present, so `isBrowser` is false, but `window.porcelain.platform`
 * is 'linux'. This is the third seam case: like the browser client it wants
 * Ctrl as the primary modifier and the opaque fallback surface, but with
 * desktop-Linux word labels (Ctrl+Shift+F), not the browser's glyphs. Keyboard
 * and main.tsx fan out from here.
 *
 * vitest/jsdom note: no preload bridge, so `window.porcelain?.platform` is
 * undefined and this is `false` under test — the browser default stays the
 * baseline, unchanged by this flag.
 */
export const isLinuxShell = typeof window !== 'undefined' && window.porcelain?.platform === 'linux'

/**
 * True under the Playwright e2e harness, in EITHER runtime: the Electron shell
 * (the preload sets `porcelain.e2e` from PORCELAIN_E2E) or the browser client
 * (no preload — the harness plants a localStorage flag via addInitScript before
 * any script runs). Gates test-only affordances (the terminal buffer hook,
 * skills-toast suppression). Never set in real runs — and harmless if a user
 * sets the flag by hand.
 *
 * vitest/jsdom note: localStorage exists and returns null → `false` under test.
 */
export const isE2E =
  typeof window !== 'undefined' &&
  (window.porcelain?.e2e === true || window.localStorage.getItem('porcelain-e2e') === '1')
