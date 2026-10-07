---
name: mobile-verify
description: Verify the Porcelain development client with direct Maestro against a persistent disposable server. Use for mobile changes and native rebuilds; automated regressions run separately.
---

# Mobile verification

Use Maestro directly for inspection, input, native waits and screenshots. `C=.agents/skills/mobile-verify/scripts/cli` owns the disposable server, Metro, development client and simulator; run `$C` for its lifecycle commands. Use only Porcelain Dev and disposable data. Native builds and substantial UI work run on macOS.

## Start and drive

1. Run `$C doctor`. After native dependencies, app configuration or native modules change, run `$C build` on macOS. Run `$C start` for an iPhone, or `$C start --device ipad` for a separate tablet drive. Start prints the instance, owned simulator UDID, development link and evidence directory. Include `--instance <id>` on subsequent lifecycle commands.
2. Pass that exact UDID as Maestro's `device_id` on every call. The already paired app is the target: inspection and input must not launch, clear or reinstall it. Start currently uses agent-device for development-client connection and pairing; it is a setup dependency, not an interactive driver or fallback.
3. Use `inspect_screen`, then `run` for a small action or bounded wait, then inspect again. Derive targets from the current hierarchy; copy dynamic environment labels whole. `take_screenshot` records visual state and resolves missing accessibility traits. A heading alone does not prove a selected tab or a dismissed menu.

The installed Maestro MCP accepts a flow header even for one action:

```yaml
appId: com.fabiofiorita.porcelain.dev
---
- tapOn:
    text: Files
- assertVisible:
    text: Files
    selected: true
```

Use the actual tool schemas. The upstream CLI is also available with an explicit `--udid`; do not build a repository action adapter around either interface. [Maestro MCP documentation](https://docs.maestro.dev/get-started/maestro-mcp) describes inspection, inline flows and screenshots. The optional [journey notes](features/README.md) describe product navigation and useful observations.

## Change and refresh

JavaScript changes need no native build. Run `$C refresh --instance <id>` after editing client code. A failed Metro reload exits nonzero and leaves the recorded source fingerprint unchanged. Success means the reload request was accepted; inspect the changed behavior with Maestro before claiming the app runs the new code. Doctor compares source with the last start or accepted reload request, not with the device's loaded JavaScript.

Server, CLI or native changes require the restart or rebuild reported by doctor. For a cold launch, explicitly stop the development app and reopen the printed development link through Maestro, preserving app data. Accept a system confirmation only when it is visible, then wait for the actual app. A loading frame is intermediate evidence. Workspace persistence and tab selection are separate observations.

For connection status, establish the exact environment Online before changing its disposable server. Capture the owned controller's suspend/resume times, use a bounded native wait for Offline/Online, and inspect each result before reloading. Report missed observation deadlines separately from product failures. Signal only captured owned processes; always resume a suspended server before cleanup.

## Evidence and stop

Keep exact upstream calls, timestamps, hierarchy, screenshots and errors in the instance's private evidence directory. `$C logs` records app/Metro/server logs; `$C evidence` lists retained artifacts. Server evidence supports UI observations, it does not replace them. Pairing links and screenshots containing credentials stay private; direct Maestro tool transcripts are not automatically redacted by the lifecycle CLI.

Run `$C stop --instance <id>` when finished. Sessions have no idle expiry. A failed stop retains runtime state: inspect its report before retrying. Confirm the exact owned simulator is Shutdown and captured processes are gone; the shared stop result alone does not certify simulator shutdown. Evidence remains available after stop.

## Automated regressions and scope

Interactive verification records the current journey. Run focused Vitest/Maestro regressions separately after stopping the interactive instance, because they own their own simulators. Choose cases from the changed behavior and existing tests, not a mandatory map inventory. CI owns full suites.

```sh
pnpm --filter @porcelain/mobile exec vitest run --config ../../vitest.config.ts --project @porcelain/mobile-e2e <file name>
pnpm --filter @porcelain/mobile exec vitest run --config ../../vitest.config.ts --project @porcelain/mobile-e2e-tablet <file name>
```

The direct procedure was exercised on an iPhone simulator. iPad, Android, physical-device Local Network permission, gestures and text input require their own proof. Current Files/Review/History are empty states, with no file detail/editor stack. Optional journey notes need no schema, test-link checker or API/source synchronization; update only useful navigation and observations. API contracts remain in `packages/contracts`.

The ignored `.mobile-device-host.json` and agent-device hub support existing remote setup. Use `workstation` for that connection; do not overwrite its configuration. Remote setup success does not establish a direct Maestro remote drive. Keep native UI work in a macOS-hosted chat with direct tools.

Report the platform, changed behavior observed, focused tests, evidence and remaining limits.
