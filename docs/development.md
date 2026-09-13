# Development

Use the Node version in `.node-version` and pnpm version in `package.json`.

```sh
npx --yes pnpm@12.3.4 install --frozen-lockfile
pnpm dev
```

Open <http://127.0.0.1:5173>. This starts the real API and Vite, creates disposable sample Git
repositories and SQLite state under ignored `.playgrounds/`, and connects the browser automatically.
Ctrl+C stops the owned processes and removes that run. Restarting creates fresh sample data.
The [sample guide](../playgrounds/README.md) explains the review scenarios.

`pnpm dev --manual` exercises token entry. `pnpm dev:web` starts only Vite; set
`PORCELAIN_API_TARGET` to a separately running API address to proxy `/api` requests.
Mocks are test fixtures, not a separate way to run the application.

## Checks

Run focused specs and changed-file checks while developing:

```sh
pnpm exec vitest run apps/web/src/views/workspace/workspace-view.spec.tsx
pnpm exec biome check path/to/changed-file.ts
pnpm typecheck
```

`pnpm test:coverage` runs Vitest directly with the coverage thresholds in
[its configuration](../vitest.config.ts). There is no task cache or coverage merger.
`pnpm verify` runs the full checks, including browser smoke; CI owns routine full verification.
React Doctor runs explicitly and in CI, without a blocking commit hook.

Browser smoke uses a real disposable API and built web assets. Install Chromium once:

```sh
pnpm --filter @porcelain/web exec playwright install --with-deps chromium
pnpm test:web:smoke
```

Tests own their sample repositories and processes. Existing server specs exercise real Git,
SQLite and HTTP; renderer specs use real providers with controlled API fixtures. Browser proof
covers the browser only. Electron, mobile and remote connectivity need verification when introduced.

## Standalone server

The standalone server can host a built browser client and its API from one origin. Build the
web app first, then supply an explicit data directory, port, token and absolute web root:

```sh
pnpm --filter @porcelain/web build
PORCELAIN_DATA_DIRECTORY="$(mktemp -d)" \
PORCELAIN_PORT=0 \
PORCELAIN_HOST=127.0.0.1 \
PORCELAIN_WEB_ROOT="$PWD/apps/web/dist" \
PORCELAIN_TOKEN="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')" \
pnpm --filter @porcelain/server start
```

`PORCELAIN_HOST` defaults to `127.0.0.1`; set it explicitly to a LAN address or `0.0.0.0` when
the machine should accept LAN connections. The host is validated before state is created, and
the server never widens its listener implicitly. `PORCELAIN_WEB_ROOT` is also opt-in and must be
an absolute path; without it the process remains API-only. Browser API requests use `/api`, while
the root paths remain available for the Vite development proxy and existing integrations.

The server prints its address, never its token. Use a caller-managed token if connecting manually.
SIGINT/SIGTERM closes the server; remove disposable state after it stops. Only one process may own
a data directory. After a crash, establish that its owner has stopped before removing
`server.lock`; retain the database and migration data.

## Database changes

Drizzle owns the schema and migrations. Run `pnpm --filter @porcelain/server db:generate`, review
and commit the generated migration files. Startup applies migrations; do not use `drizzle-kit push`
against application state. The rebuild is unreleased, so the baseline can be regenerated and tested
with fresh disposable data. Add upgrade compatibility only when there is a supported release to upgrade.
