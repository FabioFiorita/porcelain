/**
 * The one browser-vs-shell seam. Porcelain's renderer ships as BOTH the Electron
 * app's window (the preload injects `window.porcelain` — the shell bridge) and,
 * since remote-envs Phase 3, a plain browser client the daemon serves at `/`
 * (no preload, so `window.porcelain` is undefined). Everything that only exists
 * shell-side — the shell tRPC router (updater/skills-mcp/reveal/new-window),
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
