# Phase 1 design — extraction + always-local daemon

Parent spec: `plans/remote-environments.md`. This doc is the implementation contract for Phase 1; sub-agents follow it exactly. Read the `architecture` and `audit` skills before touching code — every invariant there still applies.

## Goal

Porcelain becomes client/server **on one machine**: the Electron main process spawns a headless **daemon** (Electron-free Node code) and the renderer talks to it over HTTP + one WebSocket on `127.0.0.1`. Behavior is indistinguishable from today. No auth (Phase 2), PTYs still die with their window (Phase 2), no remote anything (Phase 2/4).

## Non-negotiable constraints

- All CLAUDE.md hard rules; every `audit` invariant (esp.: MCP adds no inbound network surface — **the daemon binds `127.0.0.1` only** and this stays true until Phase 2's tailnet+token work; `GIT_OPTIONAL_LOCKS=0`; atomic json-store writes; watcher O(open tabs)/O(expanded dirs); CSP stays the artifact backstop).
- No `any`, no `as unknown as`, no `void promise`. Biome + typecheck + tests + build green before each commit.
- Two stages, each landing on `main` gate-green. No branches.

## Target layout

```
src/backend/          Electron-free package (NEW) — the daemon's code
  api.ts              appRouter (~all of today's procedures minus shell ones)
  server.ts           daemon entry: http server (/trpc via fetchRequestHandler) + ws upgrade
  session.ts          per-connection state: app-event fan-out, terminal routing, watch registration
  <everything GREEN>  git.ts, flow.ts, diff.ts, feature-*, fs-ops.ts, all *-store.ts, json-store.ts,
                      home-channel.ts, repo-config.ts, config-store.ts, app-events.ts,
                      file-watch.ts, review-watch.ts, terminal-manager.ts, read-limits.ts,
                      conventions.ts, suggestions.ts, fuzzy.ts, external-url.ts (pure guard),
                      + all their sibling .test.ts files (they move too)
src/shared/           already exists; add ws-protocol.ts (zod schemas for the WS session messages)
src/main/             Electron shell ONLY
  index.ts, window.ts, menu.ts, updater.ts, dev-config.ts
  daemon.ts           spawn/manage the daemon child (NEW)
  shell-api.ts        shellRouter (NEW): openRepo dialog, revealInFinder, newWindow, windowInit,
                      updateStatus/checkForUpdates/installUpdate, pluginInfo/installPlugin/
                      cursorPluginInfo/codexInfo + installers
  ipc.ts              shrinks to: shellRouter mount over invoke('trpc-shell') + shell-event push
src/mcp/              unchanged (already dependency-free)
```

Alias: add `@backend/*` → `src/backend/*` in **all four** places (`electron.vite.config.ts`, `tsconfig.web.json`, root `tsconfig.json`, `vitest.config.ts`). Renderer `@main/api` type-imports become `@backend/api` (type-only, as today). `@main` alias stays for `ShellRouter` + `AppEvent` types.

## Router split

- `appRouter` (`src/backend/api.ts`): every procedure that is pure Node. Includes `gitDiscardFile`/`trashPath` — replace `shell.trashItem` with the `trash` npm package (files must be trashed on the machine that owns them; `trash` is cross-platform, goes in `dependencies`).
- `shellRouter` (`src/main/shell-api.ts`): the Electron-native procedures listed above. Same tRPC version/idioms; context stays `{ sender }` here (it's Electron-side).
- `TrpcContext` for `appRouter` becomes **empty** — `ctx.sender` consumers (`watchFiles`, `watchDirs`, `windowInit`) either move to the WS session (watch registration) or to `shellRouter` (`windowInit`). `newWindow` stays shell. **No procedure in `src/backend` may reference a connection**; per-connection concerns live in `session.ts`.

## Transport (stage 2)

- **HTTP** `POST/GET 127.0.0.1:<port>/trpc` — tRPC fetchRequestHandler, same pattern as today's `ipc.ts` but on a real `http.createServer`. Port 0 (OS-assigned); daemon prints one JSON line `{"port": N}` on stdout when ready.
- **WS** same port, path `/session`, npm `ws` (goes in `dependencies` + `@types/ws` dev). One socket per window. All messages zod-validated via `src/shared/ws-protocol.ts`:
  - server→client: `{t:'app-event', event}` (broadcast: feature-view, comments, board, actions, layers, artifact, update… no — update-status is shell; see below) · (targeted: working-tree, file-tree) · `{t:'terminal:data'|'terminal:exit', id, …}` · `{t:'terminal:created', reqId, id}`
  - client→server: `{t:'terminal:create', reqId, cwd, initialInput?, cols?, rows?}` · `{t:'terminal:write'|'resize'|'kill', id, …}` · `{t:'watch:files', paths}` · `{t:'watch:dirs', paths}`
- `file-watch.ts`'s `FileWatchSender` is already structural — the WS session object implements it. Watchers + PTYs are reaped on socket close (today's semantics, keyed by connection instead of `WebContents`).
- **Shell events** stay on a tiny Electron push channel (`shell-event`): `close-tab` (Cmd+W) and `update-status` (updater lives in the shell). `use-app-events.ts` consumes both sources; the `AppEvent` union splits into daemon events and shell events (keep one renderer-facing union type).
- **Renderer wiring** (`lib/trpc.ts`): two clients — `trpc`/`trpcClient` (appRouter, plain `httpBatchLink` to the daemon URL, no custom fetch) and `shellTrpc` (shellRouter over the surviving IPC shuttle). Daemon URL comes from `window.porcelain.daemon` (`{url}`) injected by preload from a value main passes via `additionalArguments` or an exposed getter; abstract behind one `daemonBaseUrl()` helper so Phase 3 can fall back to `window.location.origin`.
- **CSP** (`index.html`): add `connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*`. Do NOT touch `img-src` (artifact exfil backstop — audit).

## Daemon lifecycle (stage 2)

- Build: second entry in the **main** build of `electron.vite.config.ts` (same trick as the MCP server) emitting `out/main/daemon/server.js`. Externalized deps (`@trpc/server`, `ws`, `node-pty`, `zod`, `trash`) stay in `dependencies`.
- Spawn: `spawn(process.execPath, [daemonPath], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORCELAIN_USER_DATA: app.getPath('userData'), PORCELAIN_DEV: is.dev ? '1' : '' } })`. `ELECTRON_RUN_AS_NODE` keeps node-pty's Electron-ABI build valid. `config-store.ts` resolves its dir from `PORCELAIN_USER_DATA` (daemon) — the config file location does not change, zero migration. `dev-config.ts` seeding moves daemon-side, gated on `PORCELAIN_DEV`.
- Lifecycle in `src/main/daemon.ts`: parse the ready line, resolve the port; restart with backoff (cap ~3 tries/10s) on crash, re-inject the new port into open windows (renderer WS client reconnects; queries retry); kill on `app.quit`; daemon also self-exits when stdin closes (parent death).
- e2e: env (incl. `PORCELAIN_E2E`, `PORCELAIN_REVIEW_SETS`) is inherited by the child — fixture unchanged in principle; run `pnpm test:e2e` once at the end of stage 2 to confirm (it's the release gate, not the commit gate).

## Enforcement

Biome `noRestrictedImports`: importing `electron` (and `@electron-toolkit/*`) is an **error** in `src/backend/**` and `src/renderer/**`. (Preload and `src/main` keep it.) Add in stage 1 so the fence exists from the first commit.

## Stages

**Stage 1 (commit: `refactor: extract electron-free backend package`):** the file moves (`git mv`, keep history), router split, alias plumbing, Biome fence, `trash` swap, `config-store` env-path (main passes it via a setter call for now — still in-process), both routers mounted over today's IPC (two `ipcMain.handle` channels: `trpc` → appRouter, `trpc-shell` → shellRouter; renderer gets its two clients now, both over IPC). App behavior identical; full gate green.

**Stage 2 (commit: `feat: local porcelain daemon — renderer talks HTTP/WS to an electron-free backend`):** daemon entry + session channel + spawn/lifecycle + renderer transport swap (appRouter client → real HTTP; terminal/watch/app-events → WS) + CSP + preload slimming (drop `trpc` shuttle for appRouter, keep shell shuttle + shell-event + daemon URL). Full gate green + live verification in the dev app (open repo, changes list, terminal spawn + survive tab close, file edit from terminal refreshes viewer, feature view, board) before commit.

## Acceptance (Phase 1 done)

Daily driving indistinguishable; `pnpm verify` green; e2e suite green; Biome fence in place; `rg -n "from 'electron'" src/backend src/renderer` empty; daemon listens on 127.0.0.1 only (`lsof -iTCP -sTCP:LISTEN` shows loopback bind); kill -9 the daemon while the app runs → it restarts and the UI recovers.
