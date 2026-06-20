# Plan 014: Renderer/process hardening — `will-navigate` guard + explicit `contextIsolation`

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If a "STOP condition" occurs, stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/main/window.ts src/main/external-url.ts`
> If either changed since this plan was written, compare against "Current state"; on
> a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (defense-in-depth)
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

The app's trusted-renderer model holds (no remote content; CSP present;
`nodeIntegration` off; `contextIsolation` on by Electron's default). Two cheap
hardening steps make that boundary explicit and complete:

1. **No `will-navigate`/`will-redirect` guard.** `setWindowOpenHandler` gates
   `window.open`/`target=_blank` through `isSafeExternalUrl`, but there's no handler
   for **top-level navigations** of the app frame (a bare in-app `<a href>` without
   `target`, a `location =` assignment, a form post). Today every link surface forces
   `target="_blank"`, so the gap isn't reachable — but the protection rests on every
   future link-emitting surface remembering that. A `will-navigate` handler closes it
   structurally, reusing the same allowlist.
2. **`contextIsolation` is implicit.** `webPreferences` sets `sandbox: false` but does
   not set `contextIsolation` (it relies on Electron's secure default of `true`, which
   the preload actively depends on via `process.contextIsolated`). Setting it
   explicitly intent-locks the secure value so a future Electron default change — or a
   careless edit — can't silently weaken the boundary.

## Current state

`src/main/window.ts` — `webPreferences` (lines ~51–57):
```ts
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: false,
  ...(isE2E ? { backgroundThrottling: false } : {}),
},
```
The existing window-open guard (lines ~99–104):
```ts
mainWindow.webContents.setWindowOpenHandler((details) => {
  if (isSafeExternalUrl(details.url)) {
    shell.openExternal(details.url)
  }
  return { action: 'deny' }
})
```
The load (lines ~106–111):
```ts
if (is.dev && process.env.ELECTRON_RENDERER_URL) {
  mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
} else {
  mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}
```
`src/main/external-url.ts` exports `isSafeExternalUrl(url)` (allowlist
`http:`/`https:`/`mailto:`). `is`, `shell`, and `isSafeExternalUrl` are already
imported in `window.ts` (confirm at the top of the file).

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `pnpm typecheck`   | exit 0 |
| Lint      | `pnpm lint`        | exit 0 |
| Tests     | `pnpm test`        | all pass |
| Full gate | `pnpm verify`      | all four pass |

## Scope

**In scope**:
- `src/main/window.ts` (add `will-navigate` handler; set `contextIsolation: true`)

**Out of scope** (do NOT touch):
- `isSafeExternalUrl` / `external-url.ts` — reuse as-is; do not widen the allowlist.
- `sandbox: false` — leave it (the preload imports Node builtins; enabling the
  sandbox is a separate, larger change). Just add a one-line comment noting it's a
  deliberate opt-out paired with `contextIsolation: true`.
- `setWindowOpenHandler` — keep it; `will-navigate` complements it, doesn't replace it.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `chore(security): add will-navigate guard and set contextIsolation explicitly`.
- Do NOT push unless instructed.

## Steps

### Step 1: Make `contextIsolation` explicit

In `webPreferences`, add `contextIsolation: true` and a short comment that
`sandbox: false` is a deliberate opt-out (the preload needs Node builtins) paired
with explicit isolation:
```ts
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  // Deliberate: the preload imports Node builtins, so the sandbox is off; isolation
  // is set explicitly so a future Electron default change can't weaken the boundary.
  contextIsolation: true,
  sandbox: false,
  ...(isE2E ? { backgroundThrottling: false } : {}),
},
```

### Step 2: Add the `will-navigate` guard

Next to `setWindowOpenHandler`, add:
```ts
mainWindow.webContents.on('will-navigate', (event, url) => {
  // The app frame must never navigate away from its own renderer. Allow only the dev
  // HMR origin; block any other top-level navigation and hand a safe URL to the OS
  // opener — the complement to setWindowOpenHandler (which only covers window.open /
  // target=_blank).
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (is.dev && devUrl && url.startsWith(devUrl)) return
  event.preventDefault()
  if (isSafeExternalUrl(url)) shell.openExternal(url)
})
```
Place it before the `loadURL`/`loadFile` block (handler registration order doesn't
matter, but keep it grouped with the window-open handler for readability).

### Step 3: Verify dev still loads and the gate passes

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.
**Verify**: `pnpm verify` → all four pass.
**Verify (manual, recommended)**: `pnpm dev` opens the app normally (the dev HMR
load is allowed by the guard). The app's existing external links (e.g. a markdown
link) still open in the browser via `setWindowOpenHandler`.

## Test plan

- Electron main-process window wiring isn't unit-tested in this repo (it needs a real
  Electron window). Per `.agents/skills/audit/SKILL.md` ("How to verify"), these
  process-boundary guards are verified by a **read of the diff** plus the gate.
  Verification here is: the gate passes, the guard routes through `isSafeExternalUrl`,
  and `pnpm dev` still loads (Step 3).
- The e2e suite (`pnpm test:e2e`, a release gate) launches the built app; if you run
  it, confirm the app still boots (the dev-URL allowance is dev-only; the built app
  loads via `loadFile`, which doesn't trigger `will-navigate`).

## Done criteria

ALL must hold:

- [ ] `webPreferences` sets `contextIsolation: true` explicitly
- [ ] A `will-navigate` handler exists that `preventDefault`s and routes safe URLs
      through `isSafeExternalUrl` → `shell.openExternal`, allowing only the dev HMR origin
- [ ] `pnpm verify` passes; `pnpm dev` still opens the app
- [ ] Only `src/main/window.ts` is modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Adding the `will-navigate` guard blocks the dev HMR load or any legitimate in-app
  navigation (the app goes blank) — report; the dev-URL allowance may need widening
  (e.g. a trailing-slash mismatch).
- `contextIsolation: true` breaks the preload bridge (the renderer can't reach
  `window.porcelain`) — that would mean something relied on isolation being off;
  report rather than reverting to implicit.

## Maintenance notes

- New main-window creation paths (`createWindow` is re-callable for multi-window)
  must carry both settings — if a second `webPreferences` block appears, mirror them.
- Electron Fuses (a packaging-side hardening) is a **separate** plan (packaging
  hardening) — this plan is the in-process half only.
- A reviewer should confirm the allowlist (`isSafeExternalUrl`) is still the single
  external-URL gate (`.agents/skills/audit/SKILL.md` invariant) and that nothing now
  calls `shell.openExternal` without it.
