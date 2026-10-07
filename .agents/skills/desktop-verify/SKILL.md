---
name: desktop-verify
description: Launch disposable unpackaged Porcelain Dev, publish its renderer CDP and raw Playwright Electron lifecycle, and verify native desktop features. macOS owns menus, sheets, Keychain and window transitions; Linux supports bounded renderer launch and shutdown.
---

# Desktop verification

The launcher prepares and records; the agent drives the surface. Never build, install, launch or point a test at the installed Porcelain app or its service/data. Each start stages unpackaged Porcelain Dev in instance-owned storage with a disposable profile and a real sample Git repository.

`C=.agents/skills/desktop-verify/scripts/cli`, from the checkout root. Run `$C` alone for help. Commands are `start`, `doctor`, `status`, `logs`, `evidence`, `stop`; there are no UI commands, eval endpoint, picker interceptor or private RPC.

## Start and connect

```sh
$C doctor
$C start
```

The short card prints server/web/WebSocket URLs, the exact pairing and MCP commands, evidence and stop commands, renderer URL/CDP, and the lifecycle entry point. Private `connection.json` contains build identity, fixture paths, owner socket, credential file paths, app/server PIDs, staged path, disposable profile, launch-options file and platform capabilities. Launch options contain inherited environment values: keep that file private and never attach it to a PR.

The sample repository starts unregistered so the real folder-picker journey can prove registration. `fixtures.projectId` and `worktreeId` are empty until a project is opened; read `/api/inventory` through the app renderer for its IDs. The app's local server credential remains in the app host's memory. `credentialFiles.remoteEncrypted` names the disposable encrypted remote-store file, which may not exist yet.

Use the published renderer CDP endpoint with a browser tool that supports attachment, or Computer Use on the exact development app identity. For a direct Playwright renderer connection:

```ts
const browser = await chromium.connectOverCDP(card.rendererCdpEndpoint);
try {
  const page = browser
    .contexts()
    .flatMap((context) => context.pages())
    .find((page) => page.url() === card.rendererUrl);
  if (page === undefined) throw new Error('The app renderer is missing');
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  // Operate the real OS sheet with Computer Use, then inspect the renderer.
} finally {
  await browser.close();
}
```

Do not pair or navigate this renderer as an ordinary HTTP browser: it uses `porcelain://app` and the app's trusted bridge. Direct HTTP/WebSocket clients must pair against the disposable server and use the origins in the card. The exact pairing command uses the owner socket; the exact MCP command operates in the sample repository. For protocol/auth/content-type details, read `server-verify/SKILL.md`.

## Main process and bridge

A CDP renderer connection does not expose Electron's main process. For menus, BrowserWindow and bridge journeys, run an in-process script from this checkout and import `startDesktop` from `.agents/skills/desktop-verify/scripts/start.ts`. It returns `{ electron, card, stop }`: `electron` is the raw Playwright ElectronApplication, with no command wrapper.

```ts
const folder = await mkdtemp('/tmp/porcelain-desktop-journey-');
const evidenceDirectory = join(folder, 'evidence');
await mkdir(evidenceDirectory);
const opened = await startDesktop({
  id: '1234abcd',
  folder,
  evidenceDirectory,
});
try {
  const page = await opened.electron.firstWindow();
  const packaged = await opened.electron.evaluate(({ app }) => app.isPackaged);
  if (packaged) throw new Error('Expected unpackaged Porcelain Dev');
  // Drive page locators, the public bridge and native Electron APIs directly.
} finally {
  await opened.stop();
  // Keep evidence before removing your instance folder.
}
```

The CLI supervisor calls this same entry point. The in-process caller owns `stop()`; its card's CLI stop/status commands belong to registered CLI instances only. Capture `electron.process()` before closing if the journey needs its exit code. Do not re-launch from the options file while the instance is running. A new lifecycle creates a fresh profile; regression fixtures prove restart persistence.

## Native sheets and feature evidence

Read `features/README.md`, then the feature map. Use Computer Use for the actual macOS folder sheet. The launcher never patches `dialog.showOpenDialog`. Existing picker regression tests substitute answers to prove bridge options, cancellation and registration; report that separately from observing a real sheet.

Save screenshots and journey observations in the card's evidence directory. Scrub pairing codes, credentials and inherited environment values before retaining or attaching evidence. `status --instance <id>` reads passive CDP page targets plus captured identity/staleness; it does not resize, focus or reopen windows. After source changes, stop and start again before treating new observations as proof.

## Linux and macOS boundaries

Linux needs Electron and a display. Use a desktop session, or:

```sh
xvfb-run -a $C start
```

The detached instance inherits that display, so keep the xvfb owner alive until `$C stop` completes (for a bounded script, run the entire start/renderer/stop journey under `xvfb-run`). `doctor` reports missing display or Electron; run the normal project install to obtain dependencies. If Electron remains missing, report the required binary/dependencies without changing install policy. `caffeinate` runs only on macOS.

Linux proof is one launch, renderer inspection and stop. Keychain credentials, macOS menus/sheets and window transitions stay macOS-only. The existing desktop e2e suite still refuses Linux. On macOS, Keychain writes need the logged-in session; full screen needs an unlocked screen. If Computer Use is unavailable, report bridge proof only and leave real-sheet assurance open.

## Stop and regressions

```sh
$C status --instance <id>
$C logs --instance <id>
$C stop --instance <id>
$C evidence --instance <id>
```

Stop checks captured process ownership, removes private runtime data and keeps evidence (`supervisor.log`, `electron.log`, `server.log`, stop outcome). Repeated confirmed stops are safe. Incomplete shutdown exits nonzero and retains private state; inspect the report. Stop only captured PIDs or use the lifecycle's own stop. No idle expiry; quit also stops a registered instance.

Run the changed test files and the feature's named regression file; CI owns full suites. The launcher spec is `apps/server/spec/integration/desktop-verification-cli.integration.ts`. Native picker/menu/window regressions are in `apps/desktop/spec/e2e/`. Packaged assurance belongs to release verification; this skill's `app.installed-lock` map points at `apps/desktop/src/rules/launch-refusal.spec.ts` and never launches an installed app.
