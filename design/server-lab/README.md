# Server lab

A place to understand the Porcelain server without trusting a client. The real
server runs in a traced process; every Git process, every wait in an operation
queue and every SQL statement is tied to the request that caused it. Requests
come from the real web app (embedded next to its trace), the console, scripted
benchmarks, or an agent over MCP.

Like `design/prototype`, this is a working space, not a product: iterate here,
then carry the validated result into `apps/server`.

```sh
cd design/server-lab
npm install
npm run lab            # http://127.0.0.1:5199, real web on :5198
```

`LAB_PROFILE=fixture|app|monorepo` picks the first playground (default `app`),
`LAB_WEB=0` skips the web app, `LAB_PORT` / `LAB_WEB_PORT` move the ports and
`LAB_REAL_ROOTS=/a:/b` changes where real repositories are listed (default `~/code`).

Both ports listen on loopback only. From another machine, tunnel them:

```sh
ssh -N -L 5199:127.0.0.1:5199 -L 5198:127.0.0.1:5198 <this-machine>
```

## Pages

- **Overview**: live vitals (queue depth per runner, Git processes per second,
  event-loop delay), the layers, areas and verified concerns.
- **Map**: each area as a graph from web hook to route, queue, use case, adapters
  and tables; decisions, observations with sources, test verdicts, live numbers.
- **Web + trace**: the real web app beside every request it makes.
- **Traces**: interactions, request waterfalls, per-request Git/SQL breakdown,
  work that continues after the response.
- **Console**: every route with forms generated from its Zod contract, and the
  MCP tools as an agent sees them.
- **Scale**: switch between playground profiles and read-only real projects,
  compare repository shapes, run the benchmark matrix against budgets.
- **Agent**: act on a playground like a coding agent (edit, rename, conflict,
  keep editing, lock the index) and watch the server react.
- **Tests**: what each server spec really asserts, what it fakes, and its gaps.

## Real projects

Real repositories are observed read-only. The server gets a throwaway state
directory; Git actions, commit drafts (which send code to an AI provider) and
file edits are refused before they reach it, and the action writer refuses to
execute as a second guard. Git reads use `GIT_OPTIONAL_LOCKS=0`, like
production, so an agent working in the same checkout is not blocked.
Measurements return numbers only. Repository names are hidden until you reveal
them, and real-project traces and benchmark results stay in memory. Do not
screenshot real-project pages into PRs, docs or chats.

## How it works

- `host/supervisor.ts` serves the UI (Vite middleware) and the lab API, proxies
  `/porcelain/*` to the server with the bearer token (console, benchmarks) and
  `/porcelain-web/*` untouched (the real web app), and restarts the runtime per mode.
- `host/runtime.ts` runs `createServer` from `apps/server` in-process, with the
  same isolation as `pnpm dev`, and serves it through a handler that opens an
  AsyncLocalStorage context per request.
- `host/tracing.ts` subscribes to Node's built-in `child_process` channel and to
  two channels the server publishes only for subscribers: `porcelain:operation`
  (`OperationRunner`) and `porcelain:sql` (`openDatabase`). Routes and their
  JSON schemas come from Fastify's `fastify.initialization` channel.
- `src/map/*.ts` is the curated map and test audit of the server code; update
  them when the server changes.

Filesystem reads are not traced; they show up as request time without Git.
Benchmarks mirror the web's requests by hand (`host/bench.ts`); the Web + trace
page is the ground truth for what the web really sends.
