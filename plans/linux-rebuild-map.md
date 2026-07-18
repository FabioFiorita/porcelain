# Linux port rebuild map

Goal: Linux = PRIMARY target (dev on a 24/7 Linux mini PC; e2e on Linux is the release gate; drop macOS vibrancy/glass for ONE opaque design). The 5 old patches predate main's daemon split, Agent tab, remote-environments **browser client**, and the coming design reset. Big headline: **the browser-client work already built ~2/3 of the old port's renderer surface** — the rebuild is mostly *extending an existing seam*, not re-doing patches 1 & 3, plus genuinely-new window-chrome + Linux-e2e scope.

## The key reframing (read first)
Main's renderer now serves TWO clients through one seam, `src/renderer/src/lib/platform.ts`:
`export const isBrowser = window.porcelain === undefined` — Electron shell has the preload (`window.porcelain`), the daemon-served browser client (iPad/Mac Safari, remote-envs Phase 3) does not. **`ctrlIsPrimary = isBrowser`** already drives Ctrl-as-primary-modifier + the opaque void. Linux Electron is a THIRD case the seam doesn't yet name: preload IS present (so `isBrowser` is false), but it wants Ctrl-primary + opaque + custom window controls. So the port becomes: **teach the existing predicates about Linux**, don't rebuild them. The heavy backend (git, PTYs, file-watch, agents) already runs headless on Linux (that's the Cursor Cloud VM path; `login-shell-env.ts:38` returns `/bin/bash` off darwin; daemon is a `utilityProcess.fork`).

---

## Patch 0001 — platform detection → renderer
- **Old:** `src/main/platform.ts` (`resolvePlatform`/`appPlatform`, `PORCELAIN_FORCE_LINUX=1` preview), preload exposes `platform` + a `windowControls` bridge, `main.tsx` stamps `platform-<x>` on `<html>`, and renderer `keyboard.ts` grew `isMac/hasMod/isModExclusive/kbdLabel`.
- **Changed on main:**
  - Renderer keyboard helpers **already exist and are better** (`src/renderer/src/lib/keyboard.ts`): `ctrlIsPrimary`, `isModExclusive(e, ctrlPrimary?)`, `formatKbd(tokens, ctrlPrimary)`, `kbdLabel(...)`. All pure/param-driven and unit-tested. Keyed off `isBrowser`, not platform.
  - `main.tsx:9` already stamps `document.documentElement.classList.add('browser')` (not `platform-linux`) for the void.
  - Preload (`src/preload/index.ts`) has NO `platform` field and NO `windowControls` bridge yet. It gained a `daemon` url/token bridge and renamed the push channel `app-event`→**`shell-event`** (`onShellEvent`).
  - No `src/main/platform.ts` exists. Main scatters raw `process.platform` checks (`index.ts:148` window-all-closed, `window.ts:54` linux icon, `claude.ts:44` keychain).
- **Rebuild:** DON'T re-add `hasMod`/`kbdLabel` — extend the *existing* seam. Decision to surface: make the renderer predicate `ctrlIsPrimary = isBrowser || isLinux` where `isLinux` comes from a new preload `platform` field (Electron-only). A tiny `src/main/platform.ts` (`resolvePlatform` + `PORCELAIN_FORCE_LINUX`) is still worth it as the single source of truth for the window-chrome branch and the preload `platform` value. Keep the pure/unit-testable shape.

## Patch 0002 — frameless chrome + custom window controls  ← the real net-new work
- **Old:** macOS kept `hiddenInset` + vibrancy + `trafficLightPosition`; linux/win got `frame:false` + opaque `backgroundColor` + a renderer `WindowControls` cluster (`window-controls.tsx`, min/max/close over `window:minimize|toggle-maximize|close|is-maximized` IPC + a `window:maximized-changed` push). Cmd+W→Ctrl+W off-mac in the `before-input-event` interceptor.
- **Changed on main:**
  - `src/main/window.ts:37-65` still hardcodes the macOS chrome (no branch). No `WindowControls` component, no window-control IPC in `src/main/ipc.ts` (which now only carries the shell tRPC shuttle — terminals moved to the daemon WS).
  - `before-input-event` (`window.ts:96-101`) still hardcodes `input.meta` and now sends **`shell-event`** (was `app-event`).
  - `title-bar.tsx` was redesigned: it already drops side spacers for `!isBrowser`… wait, `isBrowser` — it drops them when browser (`title-bar.tsx:33`), and carries a **Remote chip** (env name + cloud + skew warning) top-right. There is currently NO window-controls slot; the right inset holds the Remote chip.
  - **DON'T-REBUILD (dies with glass):** the opaque-void branch, `--void`, and all the "preserve macOS vibrancy byte-for-byte" scaffolding. The design reset drops vibrancy for ONE opaque design, so `titleBarStyle`/`vibrancy`/`trafficLightPosition`/transparent-bg in `window.ts` all change *regardless of Linux*, and the browser void CSS (`main.css:408 html.browser`) becomes closer to the default. Do NOT build a mac-preserving `chrome = darwin ? {...vibrancy} : {...}` branch — build the opaque chrome once, then branch only on **frame + who draws min/max/close**.
- **Rebuild (net-new):** the `frame:false` + `WindowControls` cluster + `window:*` IPC + `maximized-changed` push is genuinely new and must be rebuilt. Wire `WindowControls` into `title-bar.tsx`'s right inset (coexist with the Remote chip). Add `platform`/`windowControls` to the preload bridge and its `index.d.ts`/trpc-type. Open design question: does macOS keep OS traffic lights under the opaque design, or also go custom? (Old patch kept them; with a unified opaque design you *could* keep hiddenInset traffic lights on mac and only Linux/Win get the cluster — recommend that, least churn.)

## Patch 0003 — shortcut modifiers + labels through the platform
- **Old:** swap exclusive checks to `isModExclusive`, yield ⌘T/⌘N to a focused PTY off-mac, route every `<Kbd>` label through `kbdLabel`.
- **Changed on main: ESSENTIALLY DONE ALREADY.** The browser-client work absorbed all of it: `use-app-shortcuts.ts` uses `isModExclusive` + `ctrlIsPrimary && isTerminalTarget` yield (lines 42/52/68); every user-facing label uses `kbdLabel` (14 files; remaining `⌘` glyphs are all in *comments*). The sidebar-tab list grew to 9 (`chat`/`agent`, ⌘1–9).
- **Rebuild:** NOTHING to port — it comes for free the moment `ctrlIsPrimary` includes Linux. One taste decision: browser labels use the `⌃` glyph (Ctrl symbol, chosen because the OS may be macOS/iPad). On a Linux *desktop* the old patch used the words `Ctrl`/`Alt`/`Shift` joined with `+`. Decide whether Linux desktop wants words vs the `⌃` glyph — a one-line branch in `formatKbd`.

## Patch 0004 — electron-builder Linux + CI
- **Old:** `linux:` block (AppImage + deb, unsigned), `dist:linux` script, `.github/workflows/linux-build.yml` uploading artifacts, triggered on `main`/`claude/**`.
- **Changed on main:** `electron-builder.yml` mac block is richer (dmg+zip arm64, notarize, identity). `node-pty` + `trash` are `dependencies` and `asarUnpack`'d (native `pty.node` + `spawn-helper` — need a Linux native rebuild; `npmRebuild:false` + `postinstall: electron-builder install-app-deps` handles it, verify on Ubuntu). A `daemon:dist` script + `scripts/build-daemon-dist.mjs` now exist (standalone-daemon packaging) — Linux packaging must account for the daemon build input too.
- **Rebuild:** patch is near-verbatim reusable. Update: no `claude/**` branches anymore (solo, main-only — rule 8), so trigger on `main` + `workflow_dispatch`. **Promote the CI job to run `pnpm build && playwright test` on Linux as the release GATE** (new scope, below), not just upload artifacts. electron-updater note: AppImage supports auto-update, deb does not.

## Patch 0005 — docs
- **Rebuild:** rewrite for the new reality (extend `isBrowser`→Linux seam, opaque-only design, Linux-primary e2e gate) — the old "macOS untouched, purely additive" framing is now backwards. Update `architecture` (the "Linux port" section), `releasing` (Linux builds + Linux e2e gate), CLAUDE.md nomenclature (Top bar window-controls; note the dev app already runs under Xvfb per the Cursor Cloud section). Note the working tree's in-flight MCP→CLI rename (`src/mcp/`→`src/cli/`) lands first.

---

## Genuinely-new scope the old branch never had
1. **e2e on Linux as the release gate** (`e2e/helpers/electron.ts` + `playwright.config.ts`):
   - Already Linux-friendly: `PORCELAIN_SHELL=/bin/bash` (helper line 163), `_electron.launch` of built `out/main/index.js`, window stays hidden under `PORCELAIN_E2E`, WebGL terminal buffer hook is renderer-agnostic. No arm64/mac hardcoding in the helper.
   - Needs: an **X display** (run CI under `xvfb-run` / `DISPLAY=:1`). **New screenshot baselines** — config says "Baselines are per-platform (`-darwin`)" (`toHaveScreenshot`, `maxDiffPixelRatio: 0.02`); Linux font rendering differs, so generate `*-linux.png` via `test:e2e:update` on the beelink and commit them. `PLAYWRIGHT_FORCE_ASYNC_LOADER=1` is an env flag passed to playwright (not our source) — carry it through.
   - The `_electron.launch` needs the Electron binary present: on a fresh Linux checkout `pnpm install` does NOT fetch it (Electron 42 has no postinstall) — run `node node_modules/electron/install.js` (already documented in CLAUDE.md's Cursor Cloud section).
2. **Beelink validation loop:** `DISPLAY=:1 pnpm dev` under Xvfb (already documented) for iteration; packaged AppImage/deb for release. dbus "Failed to connect to the bus" noise is harmless headless.
3. **node-pty / trash / electron-builder Linux:** native rebuild on Ubuntu, AppImage auto-update wiring, deb has none.

## Known traps
- **Ctrl+W over a focused terminal** (the one recorded unresolved refinement). Today `window.ts:96` intercepts the chord in `before-input-event` (main) and sends `shell-event 'close-tab'`. Making it `isMac ? input.meta : input.control` is trivial — but on Linux Ctrl+W then **shadows readline's word-delete**. Fix hook point: either (a) let the renderer own close-tab as a normal keydown so the xterm registry's `attachCustomKeyEventHandler` (`terminal-registry.ts`) can claim Ctrl+W first when a PTY is focused (VS Code "focused terminal gets priority"), or (b) have main skip the intercept when the renderer reports a focused `.xterm`. Alt+Backspace still word-deletes as a fallback. This is the single design-sensitive trap.
- **The `⌘/⌥` terminal edit-chord layer (`terminal-keys.ts`) is naturally macOS-only** — on Linux/Win Ctrl/Alt reach readline directly, which is correct; do NOT build a translation layer there.
- **`isBrowser` is `true` under vitest/jsdom** — keyboard tests assert the Ctrl (browser) branch. If Linux Electron also becomes Ctrl-primary, the baseline still holds; just don't let a new `isLinux` accidentally flip the jsdom default.
- **`trafficLightPosition` resets on maximize/fullscreen** (documented in `window.ts`) — moot once vibrancy/traffic-light chrome is reworked by the design reset.
- **`app-event`→`shell-event` rename**: the old patch's `send('app-event','close-tab')` must be `send('shell-event',...)` now.

## Suggested rebuild order (rough sizing)
1. **`src/main/platform.ts` + preload `platform` field** (+ `index.d.ts`/trpc type). *Mechanical, S.* Single source of truth; unblocks everything.
2. **Extend renderer seam to Linux**: `ctrlIsPrimary = isBrowser || isLinux`, void class for Linux, the `formatKbd` label-glyph decision. *Small but design-sensitive (label taste), S.* Patches 1+3 collapse into this.
3. **Window chrome + `WindowControls` + `window:*` IPC + maximized push**, wired into the redesigned `title-bar.tsx` right inset alongside the Remote chip. *Net-new, design-sensitive (must match the opaque design), M.* Coordinate with / follow the design reset so you build the opaque chrome ONCE.
4. **Ctrl+W focused-terminal refinement.** *Design-sensitive, S–M.* The trap above.
5. **electron-builder `linux:` + `dist:linux` + CI job, promoted to run the Linux e2e gate.** *Mechanical for packaging, M for the e2e gate + Xvfb + baselines.*
6. **Linux screenshot baselines** generated on the beelink, committed. *Mechanical but must run on real Linux, M.*
7. **Docs** (architecture / releasing / CLAUDE.md), reframed Linux-primary. *Mechanical, S.*

Design-sensitive: 2 (labels), 3 (chrome), 4 (terminal priority). Mechanical: 1, 5-packaging, 6, 7. Sequence 3 to ride with the design reset, not ahead of it.
