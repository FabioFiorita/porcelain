---
name: web-verify
description: Run Porcelain web journeys in Vitest Browser Mode with Chromium against disposable real servers, add or change a journey, read the coverage and the evidence, or inspect an equivalent stack through Chrome DevTools CLI. Use when changing web behavior, investigating browser failures, or measuring web performance.
---

# Web verification

A journey drives the real web app in Chromium through Vitest Browser Mode and its Playwright provider, against its own disposable server started by `scripts/dev-server.ts`. Vite proxies `/api` to that server. Nothing is mocked.

```sh
pnpm verify:web --list
pnpm verify:web projects.rename
pnpm verify:web negative.wrong-text
pnpm verify:web --all
```

## Add or change a journey

1. Find the server features the journey relies on in `.agents/skills/server-verify/feature-map/`; a journey claims only ids that exist there.
2. Write the map entry `feature-map/<domain>.<capability>.ts`. The domain is one of the web domains or `app` for the shell. The entry names the web route, how a user reaches the journey (`sidebar → project → right-click → Rename project`), its keyboard shortcut if it has one, one behaviour sentence, the server feature ids and the spec. `scripts/catalogue.ts` holds the schema and says what failed.
3. Write the spec `apps/web/spec/browser/<domain>-<capability>.browser.ts`. Import `test` from `../kit/journey`, `expect` from `vitest`, and take the fixtures the journey needs:
   - `pairedPage`: the app opened through a real one-time pairing link, with the workspace shown;
   - `unpairedPage`: the app opened in a browser that was never paired;
   - `app`: `app.link('this' | 'another')` issues a real link for this installation or one for another, `app.open(address)` opens the app there and returns the page, `app.address()` reads the address bar; the app opens once per file, so a journey that needs a fresh app is its own file;
   - `server`: typed reads of saved state, parsed with the `@porcelain/contracts` schemas (`inventory`, `project`, `devices`, `changes`, `text(path)`, `commits`, `reviewedFiles`, `commentThreads` and the rest in `apps/web/spec/kit/server.ts`); the kit owns every path;
   - `repo`: the sample repository's fixture (`repo.readme.path` and the rest) and its changes on disk: `write`, `remove`, `read`, `commit`, `branch`, `switch`;
   - `failures`: declare a failure the journey expects, `failures.console(pattern)` or `failures.response('POST /api/…', status)`.
4. Drive the page by role, label or text. Assert what the page shows with `await expect.element(locator)…` and what the server kept with `await expect.poll(() => server.…)…`. Name each case as a sentence of what the user does and sees.
5. Run the journey, then `--all`. Lint states the journey rules in `architecture/web-rules.mjs`; read a rule's message when it blocks you.

A new route the web calls needs a journey that reaches it through the UI. When a journey starts reaching a route listed in `architecture/web-journey-baseline.json`, remove that route from the list in the same change.

## What a run proves

Each journey runs against a fresh server. A journey fails on a failed assertion, a thrown error, and any console error, uncaught error, unhandled rejection or 5xx answer the journey did not declare through `failures`, or a declared one that never happened. The isolated server records every request it answered after its fixture was ready: the method, the route Fastify matched, the status, and whether the kit sent it. A journey fails when it claims a server feature none of whose routes it reached through the UI.

In CI a journey whose spec or map entry changed since the merge base with the pull request's base branch runs five times, each against a fresh server, and fails if any run fails; every other journey runs once. There is no retry.

`--all` also runs the negative journeys in `apps/web/spec/negative/`, planted journeys that must fail for what they plant: text the app never shows, a server state nobody saved, and a console error. The run prints `REJECTED` for each; their number is pinned in `scripts/catalogue.ts`.

`--all` then judges coverage. `scripts/web-routes.ts` reads the routes the web calls from the api layer (`features/*/api`, `shared/api`, `shared/live`) and matches them to the routes the server registers. A route the web calls that no journey reached through the UI fails the run unless `architecture/web-journey-baseline.json` holds it; that list only shrinks, and a listed route a journey now reaches, or one the web no longer calls, fails the run until it is removed.

The run prints one line per journey and the evidence folder. `<folder>/<journey>.json` holds the map entry, each run's failures, duration and the requests the server answered; `<folder>/<journey>/run-<n>/` holds the Vitest report, the server's hits and logs, the kit's exchanges and failure screenshots. `<folder>/summary.json` holds the negatives, the registered routes and the coverage: the routes the web calls, those reached and those not yet reached.

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

Use the page ID from `list_pages` and the evidence folder printed by `start`; do not assume page 2 or copy the example output path. `pair` issues a one-time grant for the disposable server and opens its connected review screen in that page. The wrapper forwards other Chrome DevTools CLI commands unchanged. Refer to the [official CLI guide](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/cli.md) and each command's `--help` for supported flags. The CLI supports a subset of the MCP tools.

The wrapper needs Google Chrome or Chrome for Testing. If neither is installed, install the pinned Chrome for Testing build into the user cache:

```sh
pnpm dlx @puppeteer/browsers@3.2.3 install chrome@154.0.8037.57 --path "$HOME/.cache/porcelain/chrome"
```

Set `PORCELAIN_CHROME_PATH` to an existing Chrome executable for a different installation. On hosts where Chrome's sandbox cannot start, set `PORCELAIN_CHROME_NO_SANDBOX=1` for `pnpm devtools start`.

Before reporting a web feature complete, run its journey and `--all`, and the web typecheck, lint and format checks and `pnpm arch:check`. Run `pnpm probes` after changing web architecture policy. A red result is a concrete refactor target; do not relax a guard to turn it green.
