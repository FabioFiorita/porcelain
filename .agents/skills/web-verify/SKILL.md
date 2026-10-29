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

## Sweep the standard states

Before handing off a view, run one sweep over the routes it touches; QA reruns the same command:

```sh
$C sweep reviews.page --board <Board>.png /settings/general --instance <id>
```

- Pass routes as paths (`/settings/general`) or feature maps (`reviews.page`). A map's `$projectId`, `$worktreeId` and `$environmentId` come from the instance, `$reviewId`, `$revision` and `$layerId` from the main worktree's published review; pass a concrete path for anything else. Pass the route the app settles on: a capture that lands elsewhere is a problem. Start with `--desktop` for `shell: desktop` maps such as Settings.
- `--board <png>` after a route compares it with that board: its first 1440 light capture (as-is, or the first seeded state when as-is has no review) beside the board, and the dark capture beside a `-D` or `-dark` sibling when one exists.
- Each route is captured at 1440, 1080 and 414, light and dark, in three states: as-is, then after `$C agent seed long-text` (maximum-length titles, prose, file names, computer, project and device names), then after `$C agent seed many-items` (decisions, changed files, comment threads and devices). The seeds stack: many-items diffs against the fixture base, so its review also lists the sample's and long-text's files. Every sweep publishes each seed's review as a new revision on the main worktree, so a rerun shows the same seeded states; the rest applies once per instance and stays: committing any uncommitted fixture work, the comment threads and devices, and the computer and project names. Each sweep also pairs one more `Sweep browser` device.
- As-is and a board beside it need a freshly started instance. On an instance an earlier sweep seeded, the first state is labelled `as-left` (the last seeded review, not the fixture) in the folders, the index and the JSON.
- Each capture loads the route in a fresh browser, waits for the network and text to settle, runs the checks at the listed size, then grows the window until scrolling panels show their whole content (up to 12,000 px tall) for the image. A capture whose browser call fails with a Chromium crash or out-of-memory error is retried once; a page or console error never is. The index's Retries section and the shot's `retried` field record `retried once after: <error>`, and the first attempt's problems stay, prefixed `attempt 1:`.
- Output goes to a numbered `NNN-sweep/` folder in the evidence directory: `index.md` (problems first, then a table per route), the PNGs, and `board-*.png` side-by-side images; `NNN-sweep.json` records the same results. Put the index in the PR body and attach the images.
- The sweep exits 1 when any capture has a page error, a console error, a failed document response, a redirect, horizontal page overflow, text running past its own box, a scrolling area wider than itself (one-row scrollers such as tab strips are exempt), a theme that did not apply, an unavailable or not-found page (including HTTP 200), or a board without a capture to compare, and when the sweep itself stops early. It still writes the index with everything captured so far, and stderr names the problem count, the first problem and the index.

## Compare approved boards

Run `$C board-diff --board sidebar --route /<project>/<worktree> --instance <id>` against a running instance. Set `PORCELAIN_BOARD_DIRECTORY` or pass `--board-directory <folder>` for the standalone HTML boards. Defaults: `--width 1440,414 --theme light,dark`.

The [board role maps](features/app.board-comparison.md) cover sidebar, briefing/decisions, the closing page (completion card, Not explained, Specs), every pane bar's controls and Git split button, Review panel, Changes, Settings, commit/History/graph, and PR screens/states. Each role names explicit selectors on both sides; text may differ. Extend the map when adding a screen. The command measures font size, line height, weight, letter spacing, resolved hex colour, four-sided padding/radius, row/column gap, height and visible icon presence. Length tolerance is 0.5 px; colour tolerance is one channel step; weight and icons are exact. Missing, ambiguous or hidden roles fail, as do unavailable pages, redirects and browser errors. Dedicated dark boards are used when available; otherwise their layout receives the approved desktop dark palette. This compares the mapped roles; icon identity and unmapped elements still need visual review.

Each run retains `index.md`, JSON and board/app screenshots in a numbered `board-diff` evidence folder, including on failure, and prints the Markdown table. Exit 0 means every mapped property matched; exit 1 names mismatches or capture problems. The map documents routes and setup for each screen. Browsers close on success and failure.

Before handoff, run `board-diff` for every board the change touches, paste its element table into the PR body, and fix every mismatch.

## Inject browser failures

For maps requiring browser-context failures, follow [failure injection](references/failure-injection.md).

## Restart and stop

Keep one instance per surface while iterating: Vite reloads web/shared-client edits. Server, contract or CLI edits make fixture operations refuse a stale build; stop and start again. A map-only edit needs no restart. When addressing several surface instances, pass `--instance <id>` on every command.

Run changed tests by name plus the selected map's named test for the changed feature. Then run the card's stop command and `$C evidence --instance <id>`. A confirmed stop removes private runtime/connection files and retains evidence. A failed stop exits nonzero and retains ownership state; inspect its report before retrying. Report live-driven maps separately from source review and automated specs.
