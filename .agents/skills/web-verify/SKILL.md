---
name: web-verify
description: Run Porcelain web journeys in Vitest Browser Mode with Chromium against disposable real servers, add or change a journey, read the coverage and the evidence, or inspect an equivalent stack through Chrome DevTools CLI. Use when changing web behavior, investigating browser failures, or measuring web performance.
---

# Web verification

A journey drives the real web app in Chromium through Vitest Browser Mode and its Playwright provider, against its own disposable server started by `scripts/dev-server.ts`. Vite proxies `/api` to that server. Nothing is mocked. One invocation runs journeys in parallel across up to four browsers, one per four cores of the host; `--browsers <count>` sets another number, and `--browsers 1` runs one journey at a time. Each browser is its own worker process with its own Vitest, Vite origin and Chromium, kept alive across the journeys it runs, and runs one journey at a time against that journey's own server. Before its first journey, each browser's Vite transforms the app's own modules from `src/main.tsx`, so no journey's timeouts pay for a cold transform. Each run gets Vitest's isolated test iframe and a disposable server. Between runs the worker clears cookies and browser storage and navigates the test iframe away before its server stops.

The runner holds one browser verification slot per host user: an exclusive transaction on a SQLite file in the system temp folder, which the kernel releases if the runner dies. Runs from other Porcelain worktrees on the same host wait for it, so one suite at a time spreads its journeys over the host's browsers. Separate CI hosts remain independent. The runner prints when it waits and how long acquiring the slot took.

```sh
pnpm verify:web --list
pnpm verify:web projects.rename
pnpm verify:web projects.rename projects.remove
pnpm verify:web files.edit --repeat 3
pnpm verify:web --all --browsers 1
pnpm verify:web negative.wrong-text
pnpm verify:web --all
```

## Add or change a journey

1. Find the server features the journey relies on in `.agents/skills/server-verify/feature-map/`; a journey claims only ids that exist there.
2. Write the map entry `feature-map/<domain>.<capability>.ts`. The domain is one of the web domains or `app` for the shell. The entry names the web route of the page the journey drives, how a user reaches the journey (`sidebar → project → right-click → Rename project`), its keyboard shortcut if it has one, one behaviour sentence, the server feature ids and the spec. A journey through UI only the desktop app shows, such as Settings → Sharing, adds `shell: 'desktop'`: its browser's Vite then runs in the `desktop` mode, the one `pnpm dev --desktop` and the desktop app use, and every other journey sees the web the server serves. A browser that meets a journey of the other shell restarts its Vitest in that mode and warms it again first; the runner queues desktop journeys last so each browser switches at most once. `scripts/catalogue.ts` holds the schema and says what failed. Every page route under `apps/web/src/routes` is the route of at least one entry, and `pnpm check` names a page no entry names; `__root` and a layout route, one whose folder holds child routes and whose page is its `index`, render no page of their own and need none.
3. Write the spec `apps/web/spec/browser/<domain>-<capability>.browser.ts`. Import `test` from `../kit/journey`, `expect` from `vitest`, and take the fixtures the journey needs:
   - `pairedPage`: the app opened through a real one-time pairing link, with the workspace shown;
   - `unpairedPage`: the app opened in a browser that was never paired;
   - `app`: `app.link('this' | 'another')` issues a real link for this installation or one for another, `app.remoteLink()` issues a link to the journey's remote computer at its own address, so the app pairs with it across origins, and `app.remoteLink('this')` issues one to this installation at its own address, `app.open(address)` opens the app there and returns the page, `app.address()` reads the address bar, `app.title()` the tab title, and `app.follow(address)` enters an address in the tab the app is open in; the app opens once per file, so a journey that needs a fresh app is its own file. `app.openReloadable(address)` opens the app instead in a same-origin frame and returns that frame's page; `app.reload()` then reloads the frame's document, so the app boots again in a fresh JavaScript realm from the same browser storage. The kit watches that frame for console errors, uncaught errors and unhandled rejections from before its first script; `fetchGate` and `live` do not reach it, and `app.holdLive()` instead holds that frame's live notices, across reloads, until its `release()`;
   - `server`: typed reads of saved state, parsed with the `@porcelain/contracts` schemas (`inventory`, `project`, `devices`, `changes`, `text(path)`, `commits`, `reviewedFiles`, `commentThreads` and the rest in `apps/web/spec/kit/server.ts`); the kit owns every path;
   - `remote`: a second disposable server, the remote computer, started the way the runner starts the first the first time a journey asks for it and stopped with the journey: its own installation (environment named `Remote journey computer`) and its own sample repository (project named `remote-sample`). `remote.server` reads its saved state like `server` does, plus `liveTicketHits()`, the live tickets the app asked it for; `remote.repo` changes its repository like `repo`. Its answers count toward the routes a journey reached, and an undeclared 5xx from it fails the journey too; `<folder>/<journey>/run-<n>/remote-server.json` holds its hits and logs;
   - `repo`: the sample repository's fixture (`repo.readme.path`, the branch it starts on as `repo.initialBranch`, and the rest) and its changes on disk: `write`, `remove`, `read`, `commit`, `branch`, `switch`, `merge` (a merge commit of the named branch);
   - `agent`: the coding agent's side. Through the review tools on the owner socket, `publishReview(title, step)` publishes a one-layer review whose one step points at the sample change, a `changed` step unless `step` is `'context'`, and `comment(path, body)` comments on a file as the agent; through the files API as another client, `editFile(edit)` changes the worktree;
   - `codingTool`: `codingTool.install()` puts the server fixture's fake coding tool on the server's PATH as `claude` and returns the replies it drafts (`message` for one commit, `groups` for several); until a journey installs it, the server has no coding command-line tool;
   - `failures`: declare a failure the journey expects, `failures.console(pattern)` or `failures.response('POST /api/…', status)`.
4. Drive the page by role, label or text, and name each element exactly: `exact: true` with a string, or a RegExp. Assert what the page shows with `await expect.element(locator)…` and what the server kept with `await expect.poll(() => server.…)…`. Name each case as a sentence of what the user does and sees.
5. Run the affected journey once. Use `--all` for a cross-cutting checkpoint or release, and when `components/ui` or `shared/` changed.

A new or changed behaviour is proven by its journey in the same commit: a new route, control, menu or setting gets a map entry and a journey, and a behaviour the owner changed gets its journey and map entry rewritten to the new promise. Never keep a journey passing by shaping the UI around it (a role, a label or a mounted element kept only for a locator); when a journey stands in the way of what the owner asked for, ask the owner. Lint states the journey rules in `architecture/web-rules.mjs`; read a rule's message when it blocks you.

A new route the web calls needs a journey that reaches it through the UI.

## What a run proves

Each journey runs against a fresh server. A journey fails on a failed assertion, a thrown error, and any console error, uncaught error, unhandled rejection or 5xx answer the journey did not declare through `failures`, or a declared one that never happened. The isolated server records every request it answered after its fixture was ready: the method, the route Fastify matched, the status, and whether the kit sent it. A journey fails when it claims a server feature none of whose routes it reached through the UI.

The default is one run per selected journey. Use `--repeat <count>` explicitly when investigating a flaky case or when repeated evidence answers a concrete question. Each repetition gets a fresh server and isolated test iframe with cleared cookies and browser storage. The repetitions of one journey run one after another in the same browser. There are no retries or automatic repetitions based on Git history. The runner stops at the first failed run, journey or unexpected negative result: no further journey starts, journeys already running in other browsers finish, and the evidence already collected stays. A partial run does not judge full coverage; the summary lists skipped journeys and negatives.

For ordinary feature proof, write or update the journeys for what changed, then run each affected journey once after `pnpm check`. A cross-cutting checkpoint runs `pnpm verify:web --all` once. Automatic CI runs fast checks; the runtime workflow is manual. Do not trigger hosted audits while Actions spending is blocked without Fabio's approval.

`--all` also runs the negative journeys in `apps/web/spec/negative/`, planted journeys that must fail for what they plant: text the app never shows, a server state nobody saved, and a console error. The run prints `REJECTED` for each; their number is pinned in `scripts/catalogue.ts`.

`--all` then judges coverage. `scripts/web-routes.ts` reads the routes the web calls from the api layer (`features/*/api`, `shared/api`, `shared/live`) and matches them to the routes the server registers. A route the web calls that no journey reached through the UI fails the run. A named journey does not judge coverage; discovering an uncovered route requires `--all`.

The run prints one line per journey as it finishes, with its wall time, then the evidence folder; a failed run's Vitest output is printed above its line. `<folder>/<journey>.json` holds the map entry, each run's failures, duration and the requests the server answered; `<folder>/<journey>/run-<n>/` holds the Vitest report and output (`vitest.log`), the server's hits and logs, the kit's exchanges and failure screenshots. `<folder>/summary.json` holds stage timings, the number of browsers, the negatives, the registered routes and the coverage: the routes the web calls, those reached and those not yet reached.

## Unit specs for web rules

A pure function in `apps/web/src/features/<domain>/rules/` may have a `<name>.spec.ts` beside it. `pnpm test` runs it under the `server-spec` rules; nothing else in the web gets unit specs.

## Chrome DevTools

For agent exploration and performance, use the official Chrome DevTools CLI through the repo wrapper. `start` keeps a disposable server, Vite, and an isolated Chrome profile alive across CLI calls. It prints the web origin and a local evidence folder. `stop` shuts down that session. The wrapper refuses to replace a Chrome DevTools daemon it did not start.

```sh
pnpm devtools start
pnpm devtools list_pages --output-format=json
pnpm devtools pair 2
pnpm devtools take_snapshot 2 --output-format=json
pnpm devtools list_network_requests 2 --output-format=json
pnpm devtools performance_start_trace 2 --filePath /absolute/evidence/trace.json.gz --output-format=json
pnpm devtools take_heapsnapshot 2 /absolute/evidence/heap.heapsnapshot
pnpm devtools stop
```

`pnpm devtools start --desktop` serves the web as the desktop app shows it, without the desktop bridge; `pnpm dev --desktop` runs the desktop app itself (see `desktop-verify`). Use the page ID from `list_pages` and the evidence folder printed by `start`; do not assume page 2 or copy the example output path. `pair` issues a one-time grant for the disposable server and opens its connected review screen in that page. The wrapper forwards other Chrome DevTools CLI commands unchanged. Refer to the [official CLI guide](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/cli.md) and each command's `--help` for supported flags. The CLI supports a subset of the MCP tools.

The wrapper needs Google Chrome or Chrome for Testing. If neither is installed, install the pinned Chrome for Testing build into the user cache:

```sh
pnpm dlx @puppeteer/browsers@3.2.3 install chrome@154.0.8037.57 --path "$HOME/.cache/porcelain/chrome"
```

Set `PORCELAIN_CHROME_PATH` to an existing Chrome executable for a different installation. When Chrome reports that its sandbox cannot start on this host, `pnpm devtools start` starts it again without the sandbox and prints Chrome's reason; any other launch failure stops the start; `PORCELAIN_CHROME_NO_SANDBOX=1` skips the sandboxed attempt.

Before reporting a web feature complete, follow `AGENTS.md`: `pnpm check` and affected journeys once. For an architecture or verifier change, follow the guardrail stage in `AGENTS.md`: lint rules prove themselves with fixtures in `architecture/rule-cases.mjs`, the rest with the probes you touched by name. The exhaustive probe suite is an explicit maintenance audit. A red result is a concrete refactor target; do not relax a guard to turn it green.
