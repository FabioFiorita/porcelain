---
name: desktop-verify
description: Launch disposable Porcelain Dev, use Computer Use for native macOS journeys and optional CDP for its renderer, and run focused Playwright Electron regressions. Use when changing apps/desktop, the desktop bridge contract or the Mac build, or a behaviour only the Electron shell has. Check the installed app's lock only when explicitly requested.
---

# Desktop verification

This skill covers the native folder picker, Keychain-backed remote credentials, windows and menus. Computer Use (CUA) drives the actual macOS UI. Direct Playwright Electron tests separately protect main-process, bridge, security and lifecycle promises. The web skill also covers renderer behavior; `web-verify start --desktop` provides a browser with desktop UI, so it cannot prove native behavior. Native launch and Electron tests need macOS.

Set `C=.agents/skills/desktop-verify/scripts/cli` from the repository root. Run `$C` alone for help. Its public session commands are `start`, `status`, `doctor`, `evidence` and `stop`, with `--instance <id>` where an instance must be selected. It owns disposable launch, passive observation, evidence and teardown; it does not drive UI or run tests. `installed-check` is a separate, explicitly requested operation.

## 1. Start

```sh
$C start
$C status --instance <id>
```

Start stages Porcelain Dev with a fresh temporary profile and a sample Git repository, `desktop-smoke`. Its output labels include `instance`, `evidence`, `app` (staged source), `name`, `bundle` (actual running bundle), `executable`, `pid` (app main process), `supervisor`, `cdp` (exact renderer endpoint), `profile` and `repository`. The OS can name the running development bundle Electron while the window says Porcelain. Bind CUA to `bundle` and confirm `pid`; never select an installed app by the name Porcelain. The staged `app` path alone is not the running identity.

Use `$C doctor` for tool and instance diagnostics. Status reads `app`, `processes` and native `windows` without focusing, activating or reopening the app. Process observations include PID and creation time; window observations include identity, URL, bounds, full screen, focus and visibility. Reported URLs omit query/fragment values.

## 2. Find the feature

Optional journey guides are linked from `.agents/skills/desktop-verify/features/README.md`. Use the one relevant to the behavior being checked.

## 3. Drive it

Drive the relevant user journey and compare actual state with its expected result. In CUA, select the exact running bundle, read the returned documentation, then use fresh native snapshots for menu, sheet, keyboard and window actions. The launcher leaves Electron's real folder sheet untouched. Observe and operate its native Cancel and Open project controls; a renderer screenshot or accepted Escape command does not establish native cancellation.

The common local journey is sidebar Open project → native Cancel → File › Open Project… → select the printed repository in the real sheet → History → native ⌘O → Cancel → Settings → Back → enter/exit full screen → close the window → passive status → reopen the exact development app. Read the folder-picker, menu and window guides for the expected state at each boundary.

CUA can also drive History and Settings. An optional renderer companion may attach directly to the exact CDP endpoint. For `agent-browser`, create a fresh private namespace and named session, use a private JSON config containing `{}`, and supply `--cdp` and `--no-pin-tab` on every renderer command:

```sh
agent-browser --config "<private empty config path>" --namespace "<unique namespace>" --session "<unique session>" --cdp "<cdp from start>" --no-pin-tab --json snapshot
agent-browser --config "<private empty config path>" --namespace "<unique namespace>" --session "<unique session>" --cdp "<cdp from start>" --no-pin-tab --json get url
```

Stop the renderer workflow on any failed attachment. Never follow a failed connect with an unqualified snapshot or another command: it can launch fallback Chrome. Confirm the actual target URL uses `porcelain://app/` and its visible state matches the CUA target before interaction. Inspect the current snapshot's refs, then use the same explicit options for `click <ref>`, `snapshot`, `get url` or `screenshot <private path>`. Recheck identity after target changes. Keep config, transcripts and captures outside tracked source; neither the launcher nor a raw renderer driver automatically redacts arbitrary tool output.

CDP handles renderer History, Settings and Back. Native sheets, physical menus, accelerators, full screen and native close/reopen remain CUA work. Browser JS-dialog state says nothing about an OS sheet. A menu callback or an injected picker response is bridge proof; it cannot certify physical menu selection or a native folder choice. A renderer key command returning success cannot certify its native effect. See [agent-browser CDP mode](https://agent-browser.dev/cdp-mode) and [Playwright ElectronApplication](https://playwright.dev/docs/api/class-electronapplication) for the upstream surfaces.

After editing desktop, web, server or launcher code, stop and start again to rebuild the staged target. A staged session has no hot reload. Renderer-only Vite development is a separate mode and needs its own explicit disposable profile setup.

## 4. Read the evidence and stop

```sh
$C evidence --instance <id>
$C stop --instance <id>
$C evidence --instance <id>
```

Read `000-start.txt`, numbered status records, `renderer-errors.txt` and `renderer-network.txt` alongside CUA snapshots/screenshots and any private renderer transcript. Record the exact target, attempted actions, observed native/renderer state, failures and recovery. Read retained `server.log`, `app-stop.txt`, `stop-result.json` and `workspace-stop.txt` to establish owned teardown, including exit code/signal and whether termination was forced. The workspace remains until explicit `stop` confirms owned-process completion and removes it; native Quit alone retains it. Stop only this instance's captured processes. If an optional agent-browser session was used, clean up only its private namespace/session after the launcher confirms the external Electron target has stopped; never issue a generic close against a live external target.

Reports identify which entry points, clients, contract changes, return paths and connection types applied. A local fixture journey does not establish LAN/remote pairing or the installed lock. Describe unattempted or unavailable cases explicitly.

## 5. Run the focused regression

```sh
pnpm --filter @porcelain/desktop exec playwright test spec/e2e/window.e2e.ts
```

A failed test keeps screenshots, the server log and renderer errors in `apps/desktop/test-results/e2e/`. Run only the named files relevant to the change, alongside `pnpm check:local`; full suites belong to CI. Interactive evidence does not replace these tests, and their injected picker choice does not replace real native selection.

Sessions have no idle expiry. Stop your instance when finished. After stopping, `$C evidence --instance <id>` reads the retained evidence and `$C stop --instance <id>` repeats a confirmed stop without signaling processes. A failed stop exits nonzero and retains private runtime state; inspect its report before retrying.

## Gotchas

- `safeStorage` needs the logged-in session's Keychain; an SSH credential write can fail with “User interaction is not allowed”. Native journeys run in the logged-in macOS session with direct UI access. A failed Keychain write is a failed or blocked credential case, not pairing proof.
- Full screen needs an awake, unlocked session. Wait for both the visible transition and passive status to show the expected native flag.
- CUA app reads can activate the app and reopen its last window. After closing, use only launcher `status` until zero native windows and the same app/server process identities are recorded. Then perform an explicit reopen and inspect it. Process continuity alone does not establish HTTP responsiveness.
- With two instances, select every launcher command by `--instance <id>` and every native target by its reported identity. An app Quit ends its session.

## The installed app's lock

`pnpm desktop:build` and `pnpm desktop:install` are the owner's. After the owner installs a build that changes the lock (`features/app.installed-lock.md`), and only when the owner asks, check it:

```sh
$C installed-check
```

It needs no instance, runs over SSH, launches the installed app only with disposable profiles and debugging switches, and records what each launch did; the guide describes the expected result.
