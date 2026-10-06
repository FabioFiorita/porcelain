---
name: web-verify
description: Drive the real Porcelain web app against a disposable server through the web control CLI, following the Markdown feature map, and read the evidence it records. Use before calling a web change done, when checking how a feature behaves, when measuring web performance, or when adding or correcting a feature map entry.
---

# Web verification

`C=.agents/skills/web-verify/scripts/cli`, run from the repository root. Run `$C` alone for every command, address flag and option. The CLI drives a headless, phone-width browser and records; it never asserts and never runs tests.

## 1. Start

```sh
$C start
```

It prints the instance id, the web URL, the evidence folder and the sample repository; the browser is already paired, on the sample project. A map whose frontmatter says `shell: desktop` needs `$C start --desktop`.

## 2. Find the feature

Read `.agents/skills/web-verify/features/README.md`, which also lists what every map assumes about the CLI, then the feature's `<domain>.<capability>.md`.

## 3. Drive it

Run each line of the map's **Driving it** as written and compare the page with the end state it names:

```sh
$C open /
$C click --role button --name "Toggle Sidebar"
$C click --role button --name "repository" --button right
$C fill --role textbox --name "Name" "Renamed"
$C agent publish-review "Sample review"
$C snapshot
```

- When the page is not where the map says, `snapshot` first: it shows the roles and names to address.
- Setup in words (write a file, commit, switch a branch) happens with plain shell and Git in the sample repository; the server picks it up through its watchers.
- A request held by `network hold` fails on its own after the web's 15-second request timeout, so release it within that.

To measure an interaction, wrap it in `$C trace start` and `$C trace stop`; the trace lands in the evidence as `NNN-trace.json` for Chrome DevTools' Performance panel.

## 4. Read the evidence

```sh
$C evidence
```

One numbered file per command (snapshots, screenshots, console, network), plus `browser/` and the logs. Text files and printed output are redacted, so a pairing link shows as `c=[redacted]`; screenshots are not, so keep them local. `pair` and `remote pairing-link` stand in for copying a link off the page. Report the folder and what it shows.

## 5. Run the test files the entry names, then stop

```sh
pnpm --filter @porcelain/web exec vitest run --config vitest.config.ts spec/integration/projects-rename.test.tsx
pnpm --filter @porcelain/web exec playwright test spec/e2e/<file>.e2e.ts
$C stop
```

`stop` keeps the evidence folder.

Sessions have no idle expiry. Stop your instance when finished. After stopping, `$C evidence --instance <id>` reads the retained evidence and `$C stop --instance <id>` repeats a confirmed stop without signaling processes. A failed stop exits nonzero and retains private runtime state; inspect its report before retrying.

## Gotchas

- After you edit web, server or CLI code, commands refuse until you `stop` and `start` again; a fresh instance takes seconds.
- With two instances in the checkout, every command needs `--instance <id>`.

## Add or correct a map entry

A new route, screen or flow gets its map in the same change; a map that drifted is corrected when you meet it. Copy the nearest entry, link it from `features/README.md`, and run `pnpm features:check`, which enforces the frontmatter and sections and fails on a route, selector, test or API route that does not exist or a web call no map lists. Spell selectors as the app's source does and API routes as `METHOD /api/...` with the server's parameter names. Drive the new lines once on a fresh instance and keep the evidence folder for the report.
