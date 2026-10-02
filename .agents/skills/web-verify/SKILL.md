---
name: web-verify
description: Drive the real Porcelain web app against a disposable server through the web control CLI, following the Markdown feature map, and read the evidence it records. Use before calling a web change done, when checking how a feature behaves, when measuring web performance, or when adding or correcting a feature map entry.
---

# Web verification

The CLI at `.agents/skills/web-verify/scripts/cli` starts one disposable Porcelain server through the server kit, the web through Vite and a headless Chromium session kept alive by Playwright's own CLI. It drives that browser and records every command as a numbered evidence file. It never asserts and never runs tests: you read the evidence and decide, and the tests named in the map prove what must stay true.

Run every command from the repository root.

## 1. Start

```sh
.agents/skills/web-verify/scripts/cli start
```

`start` checks its tools first and stops with the install line when one is missing: Playwright's Chromium (`pnpm exec playwright install chromium`) and, on Linux, bubblewrap for the server's sandbox. `doctor` runs the same checks and lists the live instances.

It prints the instance id, the web URL, the evidence folder and the sample repository the server serves; it never prints a credential. The browser is already paired through a one-time link, phone width (414 by 896), on the workspace of the sample project.

- **Desktop mode.** A feature whose map says `shell: desktop` lives in UI only the desktop app shows. Start with `start --desktop`: the web is served in the desktop Vite mode, the one `pnpm dev --desktop` uses, without the desktop bridge. Use `desktop-verify` for the desktop app itself.
- **Several instances.** Each `start` makes a new instance. With more than one live, every command needs `--instance <id>`.
- **Stale code.** A command refuses once the web or server code changed after `start`; run `start` again so the evidence shows the code you changed.
- **Idle.** An instance that receives no command for 30 minutes stops itself; its evidence stays.

## 2. Find the feature

Open `.agents/skills/web-verify/features/README.md` and the file `<domain>.<capability>.md` of the feature you changed or want to check. Its frontmatter names the page route, `shell: desktop` when only the desktop shows it, the selectors its steps use, the tests that guard it and the server routes it calls.

## 3. Drive it

Follow the map's **Driving it** section: run each line as written and compare the page with the end state the line names. The commands:

| Command | What it does |
| --- | --- |
| `open <route>` | opens a route of the web app, such as `/` |
| `click --role <role> --name <name>` | clicks an element by its role and exact accessible name; `--name /pattern/` matches a pattern, `--testid <id>` and `--text <text>` address by test id or visible text, `--button right` right-clicks |
| `fill --role <role> --name <name> <value>` | fills a field |
| `press <key>` | presses a key or chord, such as `Escape` or `ControlOrMeta+p` |
| `snapshot` | records the accessibility tree as Playwright's aria snapshot and prints it |
| `screenshot` | records a screenshot |
| `console` | records the console messages |
| `network` | records the requests the page sent |
| `trace start`, `trace stop` | records a Chrome performance trace through CDP |

Setup a map step names in words (write a file, commit, switch a branch) happens on disk in the sample repository `start` printed, with ordinary shell and Git commands; the server sees it through its watchers as it would any other writer.

When the page is not where the map says, take a `snapshot` before acting further: it shows the roles and names to address. A map line that no longer matches the app is drift; correct the map (step 6).

## 4. Read the evidence

```sh
.agents/skills/web-verify/scripts/cli evidence
```

The folder holds one numbered file per command (`001-open.txt`, `004-screenshot.png`, `010-snapshot.yml`, `009-trace.json`), the browser session's own page snapshots and console logs in `browser/`, and the Vite and supervisor logs. Read the snapshots and screenshots for what the page showed, `console` for errors, and `network` for the requests and their statuses. The report names the evidence folder and what it shows.

### Performance

Wrap the interaction you measure:

```sh
.agents/skills/web-verify/scripts/cli trace start
.agents/skills/web-verify/scripts/cli click --role tab --name "Files"
.agents/skills/web-verify/scripts/cli trace stop
```

`trace stop` writes the Chrome trace as `NNN-trace.json`; load it in the Performance panel of Chrome DevTools or read its events directly.

## 5. Run the tests the entry names

The frontmatter's `tests` lists the files that guard the feature:

```sh
pnpm --filter @porcelain/web exec vitest run --config vitest.config.ts spec/integration/<file>.test.tsx
pnpm --filter @porcelain/web exec playwright test spec/e2e/<file>.e2e.ts
```

`pnpm --filter @porcelain/web test:integration` and `test:e2e` run each suite whole.

## 6. Stop

```sh
.agents/skills/web-verify/scripts/cli stop
```

`stop` ends only the instance the CLI started, by the PID in its instance file: the browser session, Vite and the disposable server. The evidence folder stays.

## Add or correct a map entry

A new route, screen or flow gets its map file in the same change, and a map that drifted from the app is corrected when an agent meets it.

1. Name the file `features/<domain>.<capability>.md`; the domain is a web feature domain or `app` for the shell.
2. Write the frontmatter: `route` (the page it lives on, as `apps/web/src/routes` names it), `shell: desktop` when only the desktop shows it, `selectors` (the test ids and accessible names the steps use, each spelled as the app's source spells it), `tests` (the integration and e2e files that guard it) and `api` (every server route the feature calls, as `METHOD /api/...` with the parameter names the server uses).
3. Write the sections in order: **What it is**, **How a user reaches it** (every entry point and keyboard shortcut), **Driving it** (the exact CLI lines, each followed by the end state to look for), **What proves it works** and **Gotchas**.
4. Link it from `features/README.md`.
5. Run `node scripts/feature-maps.ts`, or `pnpm check`. It fails when a page route has no map, a map names a route, test, selector or API route that does not exist, or the web calls a route no map lists.
6. Drive the new lines once against a fresh instance and keep the evidence folder for the report.
