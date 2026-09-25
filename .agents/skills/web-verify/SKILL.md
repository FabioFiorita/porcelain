---
name: web-verify
description: Run Porcelain web behavior in Vitest Browser Mode with Chromium and an isolated server, or inspect an equivalent disposable stack through Chrome DevTools CLI. Use when changing web behavior, investigating browser failures, or measuring web performance.
---

# Web verification

The browser test command starts a disposable real server and runs Vitest Browser Mode with its Playwright Chromium provider. It proxies `/api` to the isolated server. Tests assert behavior in the browser and do not mock the API.

```sh
pnpm verify:web --list
pnpm verify:web app.shell
pnpm verify:web --all
```

Each feature has a descriptor in `feature-map/` mapping its route and intended behavior to a browser spec under `apps/web/spec/browser/`. Add a case when rebuilding a web journey. A descriptor with `needsPairing: true` gets its own one-time grant through the isolated server's owner socket, exposed to its browser spec as `VITE_WEB_<FEATURE>_CODE`. The pairing and review cases exercise the connected screen against the real API.

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

Before reporting a web feature complete, run its browser case and the web typecheck, lint and format checks and `pnpm arch:check`. Run `pnpm probes` after changing web architecture policy. A red result is a concrete refactor target; do not relax a guard to turn it green.
