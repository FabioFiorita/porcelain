# Plan 032: Clear the build-path advisories (undici, form-data) and stage the Electron 43 major

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- package.json pnpm-lock.yaml pnpm-workspace.yaml`
> If the lockfile changed since this plan was written, re-run `pnpm audit --prod`
> first — the advisory set below may already have shifted; reconcile before
> proceeding.

## Status

- **Priority**: P3
- **Effort**: S (Steps 1–3) + M (Step 4, separately committable)
- **Risk**: LOW (1–3) / MED (4)
- **Depends on**: none. Step 4 benefits from plans/027 (integration tests) having landed.
- **Category**: migration / deps
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

`pnpm audit --prod` currently reports 3 high + 2 moderate undici advisories,
every path via `electron@42.4.0 > @electron/get > undici`, and the full audit
adds a high form-data advisory via `electron-builder > … > electron-publish`.
None are on shipped-runtime code paths — `@electron/get` downloads the Electron
binary at install time; electron-publish runs on the release box — so this is
supply-chain hygiene for the build/distribution toolchain, not an exploitable
app hole. Still: a poisoned build path is the worst place to carry known-bad
HTTP clients, a dirty audit hides new real findings, and Electron majors EOL
fast (43 is current stable; 42's backport window is finite).

## Current state

- `package.json:86` — `"electron": "^42.4.0"`; `package.json:87` —
  `"electron-builder": "^26.15.3"`. Lockfile resolves `electron@42.4.0`.
- Audit output (2026-07-05): undici `<7.28.0` (WebSocket DoS GHSA-vxpw-j846-p89q,
  SOCKS5 TLS-bypass, cross-origin routing + lows) via
  `@electron-toolkit/{preload,utils} > electron > @electron/get > undici`; and
  via the builder chain undici `<6.27.0` plus `form-data >=4.0.0 <4.0.6`
  (GHSA-hmw2-7cc7-3qxx) via `electron-builder > app-builder-lib >
  electron-publish > form-data`.
- `pnpm-workspace.yaml` — `onlyBuiltDependencies: [electron, electron-winstaller,
  esbuild, node-pty]`; `package.json` `postinstall` runs
  `electron-builder install-app-deps` (rebuilds node-pty for Electron's ABI).
- Packaging invariants that any Electron/builder bump must respect (audit
  skill §Packaging — read it first): node-pty + trash stay `asarUnpack`ed;
  main/preload deps stay in `dependencies`; the fuses are set in
  `build/after-pack.js`; the daemon is forked via `utilityProcess` (the
  RunAsNode fuse behavior — a fork-bomb regression here was caught in the
  v0.19.0 release check, so Electron-major bumps get the full fuse smoke test
  from the `releasing` skill).
- Verified during the audit: every declared dep has a real consumer (no dead
  deps); react/react-dom in devDependencies is CORRECT here (renderer-only,
  Vite-bundled) — do not "fix" it.

## Commands you will need

| Purpose        | Command                     | Expected on success |
|----------------|-----------------------------|---------------------|
| Audit (prod)   | `pnpm audit --prod`         | after Step 3: no high/critical |
| Audit (full)   | `pnpm audit`                | after Step 3: no high/critical |
| Install        | `pnpm install`              | exit 0, lockfile updates only where intended |
| Full gate      | `pnpm verify`               | exit 0              |
| Packaged smoke | `pnpm dist`                 | exit 0; app in `dist/` launches (Step 4 only) |
| e2e            | `pnpm test:e2e`             | passes (Step 4 only; macOS, slow) |

## Scope

**In scope**:
- `package.json` (version ranges; a `pnpm.overrides` block if needed)
- `pnpm-lock.yaml` (via `pnpm install` — never hand-edit)

**Out of scope**:
- Source code — none of these bumps may require code changes at this tier; if
  one does, that's a STOP.
- The dev-tooling majors (`vite 8`, `@vitejs/plugin-react 6`, `@types/node 26`,
  `conventional-changelog 8`, `@base-ui/react 1.6`) — available but carrying no
  security/EOL cost; recorded in the index as "batch later, not urgent".
- node-pty / tiptap-markdown — pin-and-watch items (recorded in the index);
  no version change here.

## Git workflow

- Commit straight to `main` (hook-enforced verify; branches hook-blocked). Do
  NOT push. Steps 1–3 = one commit (`chore(deps): clear undici/form-data
  advisories on the build path`); Step 4 = its own commit, only if executed.

## Steps

### Step 1: In-range bumps first

```
pnpm update electron electron-builder electron-updater
pnpm audit --prod && pnpm audit
```

In-range updates often pull patched transitives. Record what resolved.

**Verify**: `pnpm install` exits 0; `pnpm verify` exits 0.

### Step 2: Targeted overrides for whatever remains

For advisories still present, add minimal `pnpm.overrides` to `package.json` —
scope them to the vulnerable subtree rather than global where possible, e.g.:

```json
"pnpm": {
  "overrides": {
    "@electron/get>undici": ">=7.28.0",
    "form-data@4": ">=4.0.6"
  }
}
```

(Exact keys depend on what Step 1 left — derive them from `pnpm why undici`
/ `pnpm why form-data` paths. If a major-crossing undici override breaks
`@electron/get` at install time — watch for install/postinstall errors — fall
back to the highest non-breaking patched line the advisory allows, or record
the residual as accepted with a one-line note.)

**Verify**: `pnpm install` exit 0; `pnpm audit --prod` → 0 high/critical;
`pnpm audit` → 0 high/critical (moderates: use judgment, report them).

### Step 3: Prove the toolchain still works

The overridden packages run at install/build/package time, so exercise those:

```
rm -rf node_modules && pnpm install        # @electron/get path (electron binary fetch/cache)
pnpm verify                                # full gate incl. electron-vite build
```

**Verify**: both exit 0. (`pnpm dist` is deferred to Step 4 / the next release —
electron-publish's form-data path only runs on `--publish`, which CI owns.)

### Step 4 (separate, optional this round): Electron 42 → 43

Only proceed if instructed or if Steps 1–3 left Electron-embedded advisories
unresolved. Mechanics:

1. `pnpm add -D electron@^43` (stays devDependencies — electron itself is a
   devDep here; verify against package.json before assuming).
2. `pnpm install` (postinstall rebuilds node-pty for the new ABI — if the
   rebuild fails, STOP: node-pty lags the ABI and the bump must wait).
3. `pnpm verify` → exit 0.
4. `pnpm test:e2e` → green (launches the built app; exercises PTY spawn, the
   daemon fork, the artifact sandbox).
5. `pnpm dist` → packaged app launches; run the `releasing` skill's fuse
   checks (especially: exactly ONE daemon process, listening — the fork-bomb
   check) against the packaged build.
6. Read the Electron 42→43 breaking-changes list (releases page) and grep the
   repo for each named API — the app's Electron surface is small
   (`src/main/**`, `src/preload/**`) so this is a short pass.

**Verify**: all five commands green + the fuse smoke test.

## Test plan

No new unit tests — the existing gate + e2e + the fuse checklist ARE the tests
for dependency work. The machine-checkable outcome is the audit result.

## Done criteria

- [ ] `pnpm audit --prod` reports 0 high/critical
- [ ] `pnpm audit` reports 0 high/critical (or each residual is listed in the
      status note with a one-line acceptance)
- [ ] `pnpm verify` exits 0 after a clean `rm -rf node_modules && pnpm install`
- [ ] `git diff` touches only `package.json` + `pnpm-lock.yaml`
- [ ] If Step 4 ran: e2e green + fuse smoke recorded; if not: status note says
      "Electron 43 staged, not executed"
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any override breaks `pnpm install` or the electron binary fetch — report the
  exact failing subtree; do not chase it by widening the override.
- node-pty fails to rebuild against Electron 43's ABI (Step 4.2) — the major is
  blocked upstream; record and stop.
- An advisory's only fix requires a source-code change — out of scope; report.
- electron-builder's bump changes signing/notarization behavior (visible only
  on a real release) — you can't verify that locally; note it as a release-day
  watch item, don't attempt CI changes.

## Maintenance notes

- Overrides rot: each one should carry a comment naming the advisory, and the
  next `pnpm update electron*` should try deleting them first.
- Electron majors: check node-pty ABI compatibility BEFORE each bump (this is
  the one native module and the standing gate).
- The `releasing` skill's fuse checklist is the real safety net for anything
  touching Electron/electron-builder — a reviewer should insist on it for
  Step 4-class changes.
