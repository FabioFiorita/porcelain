---
name: web-verify
description: Prepare a disposable Porcelain server and Vite, drive the web app with an independent browser tool following tool-neutral feature maps, and retain evidence. Use before calling a web change done, when checking a feature or web performance, or when correcting a map.
---

# Web verification

`C=.agents/skills/web-verify/scripts/cli`, from the repository root. The CLI owns disposable server/Vite processes and fixtures. It does not open, pair, inspect or control a browser, intercept requests, assert outcomes or run tests. Run `$C` for command help.

## Prepare and connect

```sh
$C doctor
$C start
```

Startup prints a short card: instance ID, server/web/WebSocket URLs, private `connection.json`, the exact pairing-link and MCP commands, evidence folder and stop command. Read `connection.json` for build identity, fixture IDs and paths, required origins, owner socket, credential-file paths, initial route, web mode, status/log commands and the remote-start command. Do not print credential files.

Open the card's web URL in your own fresh browser context. For a paired journey, run the exact pairing-link command and navigate to its fresh link there. Each link works once; the fragment is consumed and removed. For an unpaired journey, navigate to `/` without minting/redeeming a link. `start --desktop` exposes desktop-mode web views; it does not launch Electron or supply its native bridge. `start --coding-tool` installs the fixture's fake coding tool on the disposable server's PATH.

## Choose a driver

1. Prefer the harness's built-in browser when it supports the journey, including its snapshots, interaction and evidence tools. In T3, check `preview_status`, then `preview_open` if needed.
2. Otherwise use Playwright MCP from the project's `.mcp.json`, or the project's Playwright CLI. **Codex prefers the CLI** for this fallback. Use Playwright for request/WebSocket routing if the built-in browser cannot intercept them.

Do not add a Porcelain browser wrapper. Give your browser session a unique name and close it yourself.

For the CLI fallback, read [Playwright CLI](references/playwright-cli.md).

Accessible names in maps are exact unless written as a regex (`/^All branch changes/` means a name pattern, not literal slashes). Scope repeated controls by the map's region, dialog or tablist; use the stated document-order match only where necessary. Replace a contenteditable editor with select-all plus `page.keyboard.insertText`, rather than assuming `fill` handles it. Follow the role/name steps with any chosen driver; inspect the current accessibility tree when a target differs.

## Drive and record

Read [the index](features/README.md), then the selected map. Use a 414 × 896 viewport for its phone-width steps. Setup uses real shell/Git operations in `connection.json`'s `fixtures.repositoryPath`. Keep agent publications, typed readbacks and link minting in the fixture CLI:

```sh
$C agent publish-review 'Sample review' --instance <id>
$C server project --instance <id>
$C remote start --instance <id>
$C remote pairing-link --instance <id>
```

Record URL/title, accessibility tree, screenshots, console, HTTP method/path/status and response content type with your driver. For performance use the driver's trace/CDP tools. Store useful artifacts in the card's evidence directory. The CLI redacts its own fixture evidence; independent browser artifacts are your responsibility. Pairing fragments and screenshots may contain secrets; keep raw artifacts local and report sanitized observations. Distinguish fixture setup, browser actions, server readbacks and their observable outcome.

## Inject browser failures

Seven maps need browser-context routing. Read [failure-injection.md](references/failure-injection.md) for the recipes and per-map instructions.

## Check and stop

Run the test files the map names, sequentially when they start their own runner. CI owns full suites. After source changes, stop/start before driving again; stale instances refuse fixture operations. With multiple instances, every command needs `--instance <id>`.

```sh
pnpm --filter @porcelain/web exec vitest run --config vitest.config.ts spec/integration/projects-rename.test.tsx
# Run the exact stop command printed on the card.
$C stop --instance <id>
$C evidence --instance <id>
```

Evidence is retained; private connection/runtime files are removed after a confirmed stop. A failed stop exits nonzero and keeps its ownership state: inspect the report before retrying. Stop only the instances/session you started. Report live-driven maps separately from source-reviewed maps and automated specs.

## Correct a map

Keep frontmatter and one file per feature, link it in the index, and run `pnpm features:check`. The checker validates routes, literal selectors, named tests, contract endpoint declarations and index links; it does not establish behavior, client call reachability or prose order. Read every edited step against its source and named tests, drive changed behavior on a fresh instance, and name any steps you could only review.
