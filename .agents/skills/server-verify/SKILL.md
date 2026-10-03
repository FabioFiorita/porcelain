---
name: server-verify
description: Start a disposable, sandboxed Porcelain server built from the current checkout, drive its HTTP routes with the control CLI, read the state and the numbered, redacted evidence it records, then run the affected integration tests and stop it. Use before calling a server change done, or to see what a route answers today.
---

# Server verification

The control CLI is `.agents/skills/server-verify/scripts/cli`, run by path from the repository root. It drives the real server and records what happened; it never asserts. The promise a change must keep stays proven by a test in `apps/server/spec/integration/`.

## 1. Start an instance

```sh
.agents/skills/server-verify/scripts/cli start
```

It builds the server from this checkout, starts one sandboxed instance (bwrap on Linux, `sandbox-exec` on macOS) with its own port, data and sample repository, and pairs with it. It prints the instance id, the URL and the evidence folder, never the credential. When a required tool is missing it stops and names what to install; install it, never substitute another tool. The instance stops itself after 30 minutes without a command; every command counts, failed or not, and a running `live --for` keeps it awake. `doctor` checks the tools, that the instance is the one `start` started, that its port and health route answer and that its build is current:

```sh
.agents/skills/server-verify/scripts/cli doctor
```

## 2. Find the route's contract

The contracts in `packages/contracts/src/<area>/` describe every route: the request, params and response schemas named after the operation. For a rename, `renameProjectRequestSchema` and `renameProjectResponseSchema` in `packages/contracts/src/projects/inventory.ts`, served by `apps/server/src/http/routes/projects/rename-project.ts` at `PATCH /api/projects/:projectId`.

## 3. Drive it

```sh
.agents/skills/server-verify/scripts/cli request PATCH '/api/projects/{project}' name='Renamed project'
```

`request <METHOD> <path> [field=value ...]` adds the credential and prints the status and the body. `field=value` pairs build a JSON body; `field:=json` sends a non-string, such as `'anchor:={"kind":"file","filePath":"README.md"}'`. `--owner` sends the request over the owner socket (`POST /pairings`, `GET /access`, `/mcp`), and `--anonymous` sends it without a credential. `ids` lists the placeholders the CLI fills in paths and values:

```sh
.agents/skills/server-verify/scripts/cli ids
```

`live --for <duration>` subscribes to the sample project and worktree and prints the live notices the server sends while you drive it from another shell:

```sh
.agents/skills/server-verify/scripts/cli live --for 10s
```

## 4. Read the state back

```sh
.agents/skills/server-verify/scripts/cli request GET /api/inventory
.agents/skills/server-verify/scripts/cli git log -1 --oneline
.agents/skills/server-verify/scripts/cli file README.md
```

`git <subcommand> [args...]` runs Git in the sample repository; `file <path>` reads a file there. `logs` prints the server's output:

```sh
.agents/skills/server-verify/scripts/cli logs
```

## 5. Read the evidence

```sh
.agents/skills/server-verify/scripts/cli evidence
```

Every command writes a numbered file there (`001-start.json`, `002-request.json`, ...): the command, its duration, and each request and response, Git call or file read, with credentials, pairing codes, tickets, tokens and cookies redacted by the kit's recorder. `stop` adds the server's output; `supervisor.log` holds the instance supervisor's own output, redacted when it stops. A command's printed output keeps a value the next step needs, such as the code `POST /pairings` issues; the evidence never does. Report the folder and what it shows.

## 6. Run the affected integration tests

```sh
pnpm --filter @porcelain/server test:integration projects-rename
```

The argument filters by file name in `apps/server/spec/integration/`; name every file the change affects. A full run, without a filter, also fails when a registered route is requested by no test.

When a change affects a route's cost or the Git work it starts, run `pnpm --filter @porcelain/server test:perf`, and when the cost moved, set that route's budget in `ROUTE_BUDGETS` (`apps/server/src/config/limits.ts`) from fresh measurements in the same commit: Git processes exactly as measured, wall time three times the worst p95 of a few runs, rounded up to 50 ms and at least 100 ms.

## 7. Stop

```sh
.agents/skills/server-verify/scripts/cli stop
```

It stops only what `start` started: it signals the instance's PID only while that process's command line is the instance's supervisor, ends its process group and sends SIGKILL to whatever is left after 15 seconds. A recorded PID that now belongs to another process is reported and never signalled. It removes the instance's data and credential and keeps the evidence folder.

## Rules

- When the server code (`apps/server/src`, the server kit and fakes, the workspace packages the server bundles, the migrations or `pnpm-lock.yaml`) or the CLI's own scripts changed since `start`, every driving command (`request`, `live`, `git`, `file`, `ids`) refuses with `server or CLI code changed since start, run start again`; run `stop`, then `start`.
- Instances are registered per checkout: another worktree's instances are invisible here. With more than one running instance in this checkout, every command requires `--instance <id>` and lists the running instances instead of guessing.
