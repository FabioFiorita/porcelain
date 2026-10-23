---
name: web-verify
description: Prepare a disposable Porcelain server and Vite, drive the web app with an independent browser tool following tool-neutral feature maps, and retain evidence. Use before calling a web change done, when checking a feature or web performance, or when correcting a map.
---

# Web verification

From the repository root, `C=.agents/skills/web-verify/scripts/cli`. Run `$C` for command help. The CLI prepares disposable server/Vite processes and fixtures; use a browser driver for interactions and assertions.

## Prepare and connect

1. Run `$C doctor`, then `$C start`.
2. Read the card: instance ID, server/web/WebSocket URLs, private `connection.json`, pairing-link and MCP commands, evidence directory and stop command. The connection file adds build identity, fixture IDs/paths, required origins, owner socket, credential-file paths, initial route, web mode and status/log/remote-start commands.
3. Open the web URL in a fresh browser context. For a paired journey, run the card's pairing-link command and navigate to its fresh link. Each link works once and its fragment is consumed. For an unpaired journey, open `/` without minting a link.

A restarted instance reuses its worktree-derived web port while free, but needs new pairing. For a developer walkthrough, use Vite's development-only “Pair this browser” button on the not-paired page; it obtains a one-time link from the owner socket.

`start --desktop` exposes desktop-mode views without Electron's native bridge. `start --coding-tool` enables the fixture's fake coding tool in the disposable server's explicit coding-tool directory. Without it, no coding CLI is available. Host provider credentials and configuration variables are removed from verification supervisors.

## Drive and record

Use an available browser driver with snapshots, interactions and screenshots. For request/WebSocket interception use Playwright context routing; the [CLI fallback](references/playwright-cli.md) uses the project's installed Playwright. Close the browser session after the journey.

Read [the index](features/README.md), then the selected map for its entry points, locator conventions and expected states. Phone-width journeys use 414 × 896. Run shell/Git setup in `connection.json`'s `fixtures.repositoryPath`; use the fixture CLI for publications, typed readbacks and pairing:

```sh
$C agent publish-review 'Sample review' --instance <id>
$C server project --instance <id>
$C remote start --instance <id>
$C remote pairing-link --instance <id>
```

Save browser actions and resulting URL/title, snapshots, screenshots, console and HTTP status/content-type readbacks in the card's evidence directory. Use trace/CDP tools for performance. Distinguish setup, interactions and independent server readbacks. The CLI redacts its fixture evidence; sanitize browser artifacts separately, especially pairing fragments and credentials.

## Inject browser failures

For maps requiring browser-context failures, follow [failure injection](references/failure-injection.md).

## Restart and stop

Keep one instance per surface while iterating: Vite reloads web/shared-client edits. Server, contract or CLI edits make fixture operations refuse a stale build; stop and start again. A map-only edit needs no restart. When addressing several surface instances, pass `--instance <id>` on every command.

Run changed tests by name plus the selected map's named test for the changed feature. Then run the card's stop command and `$C evidence --instance <id>`. A confirmed stop removes private runtime/connection files and retains evidence. A failed stop exits nonzero and retains ownership state; inspect its report before retrying. Report live-driven maps separately from source review and automated specs.
