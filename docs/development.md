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

`pnpm dev` uses the realistic `app` profile. Pass `--profile=monorepo` to check behavior at
large-monorepo scale, or `--profile=fixture` for the small sample that tests use
([profiles](../playgrounds/README.md#profiles)). Without the flag, `--preview` and runs that set
`PORCELAIN_PLAYGROUND_DIRECTORY` (as the browser smoke does) use `fixture`.

`pnpm dev --manual` leaves the browser unpaired, so you can pair it from the Playground tab. `pnpm dev:web` starts only Vite; set
`PORCELAIN_API_TARGET` to a separately running API address to proxy `/api` requests.
Mocks are test fixtures, not a separate way to run the application.

## Checks

Specs follow three layers ([test environments](decisions/test-environments.md)):
Node units, Vitest Browser Mode for views, Playwright for the built app.

```sh
pnpm exec vitest run packages/git/src/commit-git.spec.ts
pnpm exec vitest run apps/web/src/views/workspace/workspace-view.spec.tsx
pnpm exec biome check path/to/changed-file.ts
pnpm typecheck
```

`pnpm test:coverage` runs Vitest with the thresholds in
[its configuration](../vitest.config.ts). There is no task cache or coverage merger.
View specs collect coverage in Chromium via istanbul; those percentages are
lower than jsdom/v8 counts for the same files.
`pnpm verify` runs the full checks, including browser smoke; CI owns routine full verification.
React Doctor runs explicitly and in CI, without a blocking commit hook.

Install Chromium once, then run focused Browser Mode files or smoke as usual:

```sh
pnpm --filter @porcelain/web exec playwright install --with-deps chromium
pnpm exec vitest run apps/web/src/views/workspace/workspace-view.spec.tsx
pnpm test:web:smoke
```

Smoke uses a real disposable API and built web assets. CI installs Chromium in
both the specs job and the smoke job.

Tests own their sample repositories and processes. Existing server specs exercise real Git,
SQLite and HTTP; renderer specs use real providers with controlled API fixtures. Browser proof
covers the browser only. Electron, mobile and remote connectivity need verification when introduced.

## Persistent server

`pnpm serve` is the normal persistent launcher for a Linux or macOS machine. It builds the web
app, starts the API and serves that build from one origin. It keeps the SQLite state in
`~/.porcelain/`. There is no shared access token: nothing can reach the server until a device
is paired. The launcher defaults to loopback:

```sh
pnpm serve
```

For access from another device on the same network:

```sh
pnpm serve --lan
```

The command prints the listening address. Pair the device that will use it:

```sh
porcelain pair "Laptop" --address <the address printed above>
```

The address must be one this server answers at — pairing refuses a link aimed anywhere else, which
is why nothing is guessed here. If you are unsure, open Porcelain on the device: the not-paired
screen shows the command with that device's own origin already in it.

Open the printed link on that device. It works once, expires, and carries its code in the URL
fragment, which browsers never send — so the code stays out of request lines, access logs and
`Referer` headers. The browser then holds an HttpOnly cookie no script can read, renewed on
every use and good for 90 days of disuse. `porcelain devices` lists pending links and paired
devices; `porcelain revoke <id>` ends either one at once, including any request that device is
holding open. Revoking is the only way to end a device's access: the server can expire a browser's
cookie (`DELETE /api/session`), but no control in the web app calls it today, and expiring a cookie
would not revoke the device anyway.

`--host <host>` and `--port <port>` are also available. `--lan` is shorthand for `--host
0.0.0.0`; it cannot be combined with `--host`. Use `--data-directory <absolute-path>` when a
different persistent location is required. The existing `pnpm dev` command remains the
disposable sample-project workflow.

### Upgrading from an installation that used the access token

`--token-file` is gone and fails argument parsing with the command that replaces it. An
installation that used the default path starts normally and simply leaves `~/.porcelain/admin-token`
behind, inert — Porcelain does not delete it, because it is your file; remove it when you like.
`PORCELAIN_TOKEN` in the environment is ignored. An MCP client configured with the old HTTP URL
fails until it is changed: see [agent review](agent-review.md).

## Standalone server

The underlying server can host a built browser client and its API from one origin. Build the
web app first, then supply an explicit data directory, port and absolute web root:

```sh
pnpm --filter @porcelain/web build
PORCELAIN_DATA_DIRECTORY="$(mktemp -d)" \
PORCELAIN_PORT=0 \
PORCELAIN_HOST=127.0.0.1 \
PORCELAIN_WEB_ROOT="$PWD/apps/web/dist" \
pnpm --filter @porcelain/server start
```

`PORCELAIN_HOST` defaults to `127.0.0.1`; set it explicitly to a LAN address or `0.0.0.0` when
the machine should accept LAN connections. The host is validated before state is created, and
the server never widens its listener implicitly. `PORCELAIN_WEB_ROOT` is also opt-in and must be
an absolute path; without it the process remains API-only. Every API route lives under `/api`;
there are no bare-path equivalents, and the development proxy forwards the prefix unchanged.

The server prints its address. Pair a device through the owner socket with `porcelain pair`;
there is no environment variable that grants access. SIGINT/SIGTERM closes the server; remove disposable state after it stops. Only one process may own
a data directory, and `porcelain status` reports who does. A crash needs no recovery step: the
startup lock dies with its holder and the next start removes a socket that no longer answers. The
data directory must stay owner-only (`chmod 700`), because the owner socket inside it is protected
by directory permissions.

## Database changes

Drizzle owns the schema and migrations. Run `pnpm --filter @porcelain/server db:generate`, review
and commit the generated migration files. Startup applies migrations; do not use `drizzle-kit push`
against application state. The rebuild is unreleased, so the baseline can be regenerated and tested
with fresh disposable data. Add upgrade compatibility only when there is a supported release to upgrade.
