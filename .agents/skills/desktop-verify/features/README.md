# Desktop feature map

Read [desktop verification](../SKILL.md) for lifecycle and raw Electron access. These maps cover the native shell; shared renderer behavior is in [the web index](../../web-verify/features/README.md).

## Baseline preconditions

- Set `C=.agents/skills/desktop-verify/scripts/cli` from the repository root; run `$C doctor`, then `$C start`. Use only the card's disposable Porcelain Dev identity and profile. Read private `connection.json`; set `REPO` to `fixtures.repositoryPath`.
- The sample Git repository starts unregistered so the real folder sheet can register it. Project/worktree IDs are empty until opened; read `/api/inventory` through the renderer afterward.
- Attach a browser driver to the card's renderer CDP endpoint and select `rendererUrl`, or select that exact development app through Computer Use. The renderer uses `porcelain://app` and its trusted bridge: do not pair or navigate it as an HTTP browser. Direct HTTP/WebSocket clients pair separately against the disposable server.

## Driving conventions

- Native menus, BrowserWindow and bridge journeys use the skill's in-process `startDesktop` lifecycle and raw Playwright Electron handle; CDP alone does not expose the main process. The caller owns `stop()` in `finally`. CLI stop/status applies only to registered CLI instances.
- Use Computer Use for the actual macOS menu bar/folder sheet. A substituted picker answer proves bridge behavior separately. Match roles, accessible names and menu IDs; confirm the resulting renderer state and independent side effects.
- Linux proves bounded launch, renderer inspection and shutdown only. Keychain, native macOS menus/sheets, Dock and full-screen transitions need macOS with its logged-in/unlocked session. Report unavailable surfaces explicitly.
- Keep inherited environment/launch options, credentials and pairing codes private. `credentialFiles.remoteEncrypted` may not exist until a remote is saved. Keep evidence after stopping only this run's captured processes.

## Feature entry contract

Each map has one short behavior paragraph, then three sections: How to get to it (user POV), Driving it with the surface harness, and Gotchas. Keep user paths, stable handles, required state, commands and observable proof. Frontmatter keeps the route/screen, selectors, tests, API and optional desktop shell tag for `pnpm features:check`; it is not evidence that a journey passed.

## Proof and skip reporting

- Capture the action and result, with a fresh interactive snapshot and screenshot identifying the app and destination. Store driver actions, URL/title and diagnostics in the card's evidence directory; redact pairing fragments and credentials.
- Verify mutations independently through the filesystem, Git, storage or the card's typed `$C server …` readbacks. A success toast alone is insufficient.
- Report the map, entry points, platform, width and connection actually driven. Named automated tests, source review and live proof are separate results. An unmet precondition is a reported gap, never a reason to weaken the journey.
- Restore mutated fixtures or restart the disposable instance before repeating. Stop with the card's command; retain evidence after cleanup.

## Features

- [access.remote-credentials](access.remote-credentials.md) — Encrypted credentials, unreadable storage and summaries.
- [app.mcp](app.mcp.md) — Local MCP command and executable entry.
- [app.menus](app.menus.md) — Settings, project, zoom and full-screen menus.
- [app.update](app.update.md) — App update checks, download, installation and refusal.
- [app.window](app.window.md) — Window restoration, appearance, close and quit.
- [projects.folder-picker](projects.folder-picker.md) — Folder sheet, cancellation and project registration.
