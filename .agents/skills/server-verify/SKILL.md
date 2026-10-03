---
name: server-verify
description: Start a disposable, sandboxed Porcelain server built from the checkout, drive its HTTP routes with the control CLI, read the redacted evidence it records, and stop it. Use before calling a server change done, or to see what a route answers today.
---

# Server verification

`C=.agents/skills/server-verify/scripts/cli`, run from the repository root. Run `$C` alone for every command and flag. The CLI drives and records; it never asserts.

## 1. Start

```sh
$C start
```

It prints the instance id, the URL and the evidence folder. `$C doctor` checks a running instance when something looks off.

## 2. Find the route's contract

The server has no feature map: the contract is the map. Schemas live in `packages/contracts/src/<area>/`, named after the operation; for a rename, `renameProjectRequestSchema` in `packages/contracts/src/projects/inventory.ts`, served at `PATCH /api/projects/:projectId` by `apps/server/src/http/routes/projects/rename-project.ts`.

## 3. Drive it and read the state back

```sh
$C request PATCH '/api/projects/{project}' name='Renamed project'
$C request POST '/api/worktrees/{worktree}/comments' 'anchor:={"kind":"file","filePath":"README.md"}' body=Hello
$C request GET /api/inventory
$C git log -1 --oneline
$C live --for 10s
```

- `field=value` sends a string, `field:=json` anything else. `{project}`, `{worktree}`, `{repository}` and `{home}` are filled in (`$C ids` prints them).
- Owner routes (`POST /pairings`, `GET /access`, `/mcp`) answer only over the owner socket: add `--owner`.
- `live --for` keeps printing while you drive from another shell.

## 4. Read the evidence

```sh
$C evidence
```

One numbered file per command, redacted. A value the next step needs, such as the code `POST /pairings` issues, is in the command's printed output, never in the evidence. Report the folder and what it shows.

## 5. Run the affected test file, then stop

```sh
pnpm --filter @porcelain/server test:integration projects-rename
$C stop
```

The argument filters by file name in `apps/server/spec/integration/`. `stop` keeps the evidence folder.

## Gotchas

- After you edit server or CLI code, every driving command refuses until you `stop` and `start` again.
- With two instances in the checkout, every command needs `--instance <id>`. An instance idle for 30 minutes stops itself.
- CI's full integration run fails when a registered route is requested by no test, so a new route's test must request it.
- When a change moves a route's cost or its Git work, run `pnpm --filter @porcelain/server test:perf` and set the route's entry in `ROUTE_BUDGETS` (`apps/server/src/config/limits.ts`) in the same commit: Git processes exactly as measured, wall time three times the worst p95 of a few runs, rounded up to 50 ms and at least 100 ms.
