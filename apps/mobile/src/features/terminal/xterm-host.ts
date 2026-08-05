import type { Terminal } from '@xterm/headless'

/**
 * Loading `@xterm/headless` into Hermes.
 *
 * xterm decides at IMPORT time whether it is running under Node — `'title' in process` — and
 * when that is false it reads `navigator.userAgent` to sniff the browser. React Native defines
 * `process` (with only `env`) and a `navigator` that is `{ product: 'ReactNative' }`, so the
 * sniff dereferences `undefined` and the module throws before we ever construct a Terminal.
 * Claiming the Node identity is the honest answer: headless xterm has no browser to detect, and
 * the branch it selects (a `setTimeout` idle queue instead of `requestIdleCallback`) is the one
 * it was built and tested against.
 *
 * The globals must therefore be set BEFORE the module is evaluated, which a static `import`
 * cannot promise — imports are hoisted, and an import-sorting formatter is free to move a
 * side-effect line. `require` is evaluated where it is written, so the order here is a property
 * of the code rather than a convention a later edit could quietly break.
 *
 * Deliberately NOT a dynamic `import()`, which would give the same guarantee on paper: Metro
 * turns it into an async chunk fetch, and on a native runtime that fails with "Requiring unknown
 * module" — the app boots to a red screen. `require` is bundled inline and synchronous.
 */

type ProcessLike = { title?: string }
type XtermHeadless = { Terminal: typeof Terminal }

let engine: typeof Terminal | null = null

function ensureHostGlobals(): void {
  const host = globalThis as { process?: ProcessLike }
  host.process ??= {}
  host.process.title ??= 'porcelain-mobile'
}

/** The VT engine constructor, loaded once on first use. */
export function loadTerminalEngine(): typeof Terminal {
  if (engine !== null) return engine
  ensureHostGlobals()
  const headless = require('@xterm/headless') as XtermHeadless
  engine = headless.Terminal
  return engine
}
