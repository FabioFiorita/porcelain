---
name: desktop-verify
description: Verify disposable Porcelain Dev in real Electron on Linux or macOS through renderer CDP and raw Playwright Electron. Use macOS for Keychain, Mac menus/sheets, Dock and Mac window transitions.
---

# Desktop verification

The launcher stages unpackaged Porcelain Dev with a disposable profile and sample Git repository; drive its renderer and native shell.

Use Linux for shared renderer, trusted bridge, project registration, local navigation and shutdown journeys. Use macOS when the changed behavior depends on its native shell or Keychain; an unrelated shared UI change does not require another Mac run. The driver controls the instance this skill prepares; it does not launch a replacement app or own a second profile.

`C=.agents/skills/desktop-verify/scripts/cli`, from the checkout root. Run `$C` alone for help. Use `doctor`, then `start`; the card supplies the remaining lifecycle commands.

## Start and connect

```sh
$C doctor
$C start
```

The short card prints server/web/WebSocket URLs, the exact pairing command, evidence and stop commands, renderer URL/CDP, and the lifecycle entry point. Private `connection.json` contains build identity, fixture paths, owner socket, credential file paths, app/server PIDs, staged path, disposable profile, launch-options file and platform capabilities. Launch options contain inherited environment values: keep that file private and never attach it to a PR.

The app uses an isolated home and removes host provider credentials and configuration variables. Coding CLI lookup is explicitly disabled by default, even after login-shell PATH restoration. In-process journeys can supply an absolute `codingToolDirectory` containing only their fixture executables; missing executables never fall back to PATH.

For a ready Walkthrough in desktop-mode web views, use the web verification CLI with `start --desktop --walkthrough-sample`. The native launcher below keeps its unregistered fixture for folder-picker proof.

The sample repository starts unregistered so the real folder-picker journey can prove registration. `fixtures.projectId` and `worktreeId` are empty until a project is opened; read `/api/inventory` through the app renderer for its IDs. The app's local server credential remains in the app host's memory. `credentialFiles.remoteEncrypted` names the disposable encrypted remote-store file, which may not exist yet.

Use the published renderer CDP endpoint with a browser tool that supports attachment, or Computer Use on the exact development app identity. For Playwright, attach with `chromium.connectOverCDP(card.rendererCdpEndpoint)` and select the page whose URL equals `card.rendererUrl`. Close the driver connection after the journey.

Do not pair or navigate this renderer as an ordinary HTTP browser: it uses `porcelain://app` and the app's trusted bridge. Direct HTTP/WebSocket clients must pair against the disposable server and use the origins in the card. For protocol/auth/content-type details, read `server-verify/SKILL.md`.

## Main process and bridge

A CDP renderer connection does not expose Electron's main process. For menus, BrowserWindow and bridge journeys, run an in-process script from this checkout and import `startDesktop` from `.agents/skills/desktop-verify/scripts/start.ts`. It returns `{ electron, card, stop }`: `electron` is the raw Playwright ElectronApplication, with no command wrapper.

```ts
const evidenceDirectory = await mkdtemp('/tmp/porcelain-desktop-evidence-');
const opened = await startDesktop({
  id: '1234abcd',
  evidenceDirectory,
});
try {
  const page = await opened.electron.firstWindow();
} finally {
  await opened.stop();
}
```

The lifecycle owns its temporary workspace, including the staged app, profile and launch-options file; a confirmed stop removes them together. The caller chooses and retains the separate evidence directory. The CLI supervisor calls this same entry point. The in-process caller owns `stop()`; its card's CLI stop/status commands belong to registered CLI instances only. Capture `electron.process()` before closing if the journey needs its exit code. Do not re-launch from the options file while the instance is running. A new lifecycle creates a fresh profile; regression fixtures prove restart persistence.

## Native sheets and feature evidence

Read `features/README.md`, then the feature map. Use Computer Use for the actual macOS folder sheet. Picker regression tests substitute answers to prove bridge behavior; report them separately from observing a real sheet.

Save screenshots and journey observations in the card's evidence directory. Scrub pairing codes, credentials and inherited environment values before retaining or attaching evidence. `status --instance <id>` reads passive CDP targets and captured identity/staleness. Keep one instance per surface while iterating; stop/start after source changes. A map-only edit needs no restart.

## Linux and macOS boundaries

Linux needs Electron and a display. Use a desktop session, or:

```sh
xvfb-run -a $C start
```

The detached instance inherits that display, so keep the xvfb owner alive until `$C stop` completes (for a bounded script, run the entire start/renderer/stop journey under `xvfb-run`). `doctor` reports missing display or Electron; run the normal project install to obtain dependencies. If Electron remains missing, report the missing binary/dependencies.

Linux can prove the shared renderer and bridge through real Electron, including removable power-event subscriptions, trusted IPC refusal, substituted picker answers, local pages and shutdown. Emitted power events prove delivery, not physical sleep/wake. A substituted picker answer proves the bridge, not the native dialog.

An OS accessibility driver additionally needs the accessibility bus and a window manager in the same owned graphical session; a display alone is insufficient. Select the exact disposable process/window and retain the resulting app state. Unsupported native dialogs or actions remain explicit gaps; use the renderer/Playwright handle for supported journeys.

Keychain, macOS menus/sheets, Dock and Mac window transitions require macOS. Encrypted persistence needs a real supported encrypted store; never enable plaintext storage to make Linux proof pass. On macOS, Keychain writes need the logged-in session; full screen needs an unlocked screen. If Computer Use is unavailable, report bridge proof only and leave real-sheet assurance open.

## Stop and regressions

```sh
$C status --instance <id>
$C logs --instance <id>
$C stop --instance <id>
$C evidence --instance <id>
```

Stop checks captured process ownership, removes private runtime data and keeps evidence (`supervisor.log`, `electron.log`, `server.log`, stop outcome). Repeated confirmed stops are safe. Incomplete shutdown exits nonzero and retains private state; inspect the report. No idle expiry; quit also stops a registered instance.

Run changed tests by name plus the map's named test for the changed feature. Packaged launch-refusal and build settings are covered by their unit specs; signing/fuse assurance belongs to release verification.

The desktop E2E `portable` project runs on Linux and macOS. The `macos` project retains tests tagged `@macos` and is available on macOS only; the default Mac run executes both. On Linux, run a named file through `xvfb-run -a pnpm --filter @porcelain/desktop test:e2e <file> --project portable`. Report the selected project and named tests separately from a live-driven journey. The full native Mac suite stays in CI.
