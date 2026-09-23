---
name: server-verify
description: Run Porcelain's HTTP regression net against real isolated servers and collect redacted evidence per feature. Use when verifying server behaviour or a server change, before and after a refactor, or when adding or changing a server route.
---

# Server verification

The net exercises the server over HTTP, through the real isolated server that `scripts/dev-server.ts` starts in a bwrap sandbox (Linux only). It is evidence of wire behaviour, not a unit spec.

## Commands

Run from the repository root:

```sh
node .agents/skills/server-verify/scripts/verify.ts --list        # features, intent, case count and routes
node .agents/skills/server-verify/scripts/verify.ts --all         # every feature
node .agents/skills/server-verify/scripts/verify.ts projects.rename
```

Coverage is whatever `--list` prints; there is no other list. Each feature runs against its own fresh isolated server, so no state leaks between features. Its cases run in order and share that server, so a later case may build on an earlier one.

The command prints one line per feature, each failure under it, and the evidence folder. It exits 1 when any assertion fails, a case throws or makes no assertion, a declared route was never requested, the isolated server fails to start or stop, or a feature made no assertion; it exits 2 on usage errors. Read the evidence before reporting: `<folder>/<feature>.json` holds every case's setup, request and follow-up steps (HTTP exchanges, host git commands, file writes, live notices), each assertion with expected and actual values, and the server's logs; `<folder>/summary.json` totals the run. A pass verifies only the cases in the evidence.

Credentials never reach evidence or output: the paired credential, every credential, pairing code or link a response carries, and every device cookie are replaced with `[redacted]`.

## Fixture

The isolated server starts with one registered Git repository whose README.md is committed once and then changed without staging, and one paired device whose bearer credential is the default for requests. A case discovers IDs from `session.projectId` and `session.worktreeId`; it never hard-codes them. A case that needs more history or files creates them in its setup with `session.git(...)` and `session.writeFile(...)`, which act on the sample repository from the host with fixed author and dates. The owner socket (`target: 'owner'`) is reachable from the host. The sandbox has no commit-model tool, so model-backed routes can only show their refusals.

## Descriptor format

One feature is one file, `feature-map/<feature>.ts`, whose default export is the feature; the file name must equal `feature`. The types live in `scripts/feature.ts`; shared fixture helpers in `scripts/fixture.ts`.

```ts
export default defineFeature({
  feature: 'projects.rename',
  reaches: 'PATCH /api/projects/:projectId', // or a list; owner socket routes start with "owner "
  intent: 'intended',                           // or 'observed'
  behaviour: 'The owner gives a registered project a new display name ...',
  cases: [
    defineCase({
      name: 'unknown project',
      setup: inventory,                         // optional; its result is `state`
      request: () => ({ method: 'PATCH', path: `/api/projects/${unknownUuid}`, body: { name: 'Ghost' } }),
      async expect({ response, state, session, check }) {
        check('status', 404, response.status);
        check('error body', apiError(404, 'Not Found', 'Project not found'), response.body);
        check('inventory unchanged', state, await inventory(session));   // follow-up read
      },
    }),
  ],
});
```

- `request` returns one request or a list sent in order; `response` is the last answer and `responses` all of them. A request defaults to the paired credential; `auth` can be `'none'`, `{ bearer }` or `{ cookie }`.
- `expect` asserts in code with `check` (deep equality), `checkPartial` (every key in the expected value matches) and `checkContract` (the value satisfies a schema from `packages/contracts`). Follow-up reads in `expect` are recorded as follow-up steps.
- `session.live()` opens `/api/live` as the paired viewer; `upgradeHeaders(address)` probes its rejections over plain HTTP.
- Every route in `reaches` must be requested by some case.

## Intent

`intended` behaviour was approved by the owner; change it only after agreeing the new behaviour. `observed` behaviour records what the server does today so a refactor cannot change it silently; it is not an endorsement. When an observed behaviour looks wrong, the case still asserts it and `feature-map/SURPRISES.md` names it. Fixing it means changing the server, the case and the surprise together.

## Adding or changing a feature

Write `behaviour` in domain language, cover the happy path and the main failure of every route the feature reaches (invalid input as the contract defines it, unknown IDs, conflicts; unauthenticated access is swept for every paired route by `access.authentication`), run the feature, read its evidence, then run `--all`. Keep the fixture minimal: extend `scripts/dev-server-child.ts` only when a route cannot be reached from a case's setup.
