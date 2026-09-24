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

The command prints one line per feature, each failure under it, and the evidence folder. It exits 1 when any assertion fails or is weak, a case throws or makes no assertion, a request's status or body was never asserted, a declared route was never requested, the isolated server fails to start or stop, or a feature made no assertion; it exits 2 on usage errors. Read the evidence before reporting: `<folder>/<feature>.json` holds every case's setup, request and follow-up steps (HTTP exchanges, host git commands, file writes, live notices), each assertion with its expected and actual values and its sources, what the server wrote to standard error while the case ran, and the server's whole standard output and standard error; `<folder>/summary.json` totals the run and lists the registered routes. Every case records its wall time (`durationMs`, setup to last assertion), every feature its own and its cases' (`durations`), and the run prints and records its ten slowest cases; they are numbers to read, not limits. A pass verifies only the cases in the evidence.

Secrets never reach evidence or output, however short. The run collects every secret the session issued or sent: the paired credential, every credential and pairing code by its form (`pcd_…`, `pcp_…`) and every value of a `credential`, `code`, `link`, `signature`, `token` or `secret` field, every signed summary link with its token and signature, every bearer credential and cookie a case sends, and every cookie the server sets. It looks for them in every request and response body (JSON or raw), path and header, every live notice, Git's output, file contents and the server's output, then walks the whole evidence and replaces each one, and its URL-, HTML- and JSON-escaped forms, with `[redacted]`. A feature whose evidence would still hold a secret is not written; the run fails and says so.

## Fixture

The isolated server starts with one registered Git repository whose README.md is committed once and then changed without staging, one paired device whose bearer credential is the default for requests, and a web root holding the web shell, one hashed asset and a symbolic link that leads out of it. `scripts/dev-server-child.ts` writes what it created into the session manifest, and a case reads it from `session.fixture` (folder names, branch, device label and platform, the README's path and its committed and changed text, the initial commit's subject, the web root's files, the summary link lifetime); it never types those values again. A case discovers IDs from `session.projectId` and `session.worktreeId`, and takes values the server computes (fingerprints, status tokens) from a read and values Git computes (object IDs, patches) from `session.git(...)`. A case that needs more history or files creates them in its setup with `session.git(...)`, `session.writeFile(...)` and `session.symlink(target, path)`, which act on the sample repository from the host with fixed author and dates; `session.readFile(path)` and `session.entries(path)` observe it (a listing may name the project home, `..`, but nothing above it). The owner socket (`target: 'owner'`) is reachable from the host. The isolated server refreshes its inventory every quarter second instead of every thirty seconds, so a case that changes a repository on disk waits with `eventually` until the inventory shows it, and its signed summary links expire after two seconds instead of an hour, so a case can watch one expire. The review tools are reached with `toolCall(session, id, tool, input)` on the owner socket; `toolValue(body)` parses a tool's JSON answer, which counts as part of the body.

The run bundles `scripts/dev-server-child.ts` with esbuild once, with the native packages it cannot bundle beside it and the migrations, and every isolated server runs that build. The sandbox mounts only the built server (at `/opt/porcelain/server`), the node and git binaries with Git's exec path and templates, the shared libraries those binaries and the native addons load, and the fixture folder; never the checkout, a shell or the rest of `/usr`. It runs in its own session, network, PID and IPC namespaces and dies with its parent; the host reaches the network listener at the same address through a relay over a Unix socket in the fixture folder, and the owner socket directly. The sandbox's PATH is one folder holding a symlink to git and nothing else, so no commit-model tool on the host reaches it and model-backed routes can only show their refusals. Without `/bin/sh`, through which Git reaches a local-path remote, and without a network, fetch, pull and push are verified up to the point where Git would contact the remote; no case needs more. The host's `session.git` runs without system or global configuration and with `core.hooksPath=/dev/null`, like the server's Git in the sandbox, and `session.writeFile`, `readFile`, `symlink` and `entries` resolve real paths, so a symbolic link cannot lead them out of the sample repository.

## Descriptor format

One feature is one file, `feature-map/<feature>.ts`, whose default export is the feature; the file name must equal `feature`. The types live in `scripts/feature.ts`; shared fixture helpers in `scripts/fixture.ts`.

```ts
export default defineFeature({
  feature: 'projects.rename',
  reaches: 'PATCH /api/projects/:projectId', // or a list; owner socket routes start with "owner "
  paired: true,                                 // its routes need a paired credential
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
- `expect` asserts in code with `check` (deep equality), `checkPartial` (every key in the expected value matches), `checkContract` (the value satisfies a schema imported from `@porcelain/contracts/<area>`), `checkMatch` (a string matches a pattern) and `checkDiffers` (a value moved away from an earlier one). Follow-up reads in `expect` are recorded as follow-up steps.
- An assertion counts only when its actual value was taken from something the harness observed: a response's status, headers or body (or a part of it: a nested value, a slice of a string, a list's length, the keys of an object), a live notice, a Git command's output, a file read with `session.readFile` or a folder listed with `session.entries`. A value the case computed, such as a comparison or `typeof`, is weak; so is an expected value that is a bare boolean or `{}`, a partial that holds `{}`, and a `checkDiffers` against `undefined`. A weak assertion fails the case and counts toward nothing. The evidence names each assertion's sources.
- Every response the case requested must have its status and its body asserted; a case that leaves either unasserted fails, naming the request. Reading a property is not asserting it.
- Setup reads go through `read(session, request, status?)` (or `session.read`), which fails the case unless the answer has that status (200 by default); a setup that calls `session.send` fails. A follow-up request either goes through `read` or has its status asserted.
- `paired: true` puts every route in `reaches` into the `access.authentication` sweep, which refuses each one without a credential; there is no other list of paired routes.
- `session.live()` opens `/api/live` as the paired viewer; `upgradeHeaders(address)` probes its rejections over plain HTTP.
- Every route in `reaches` must be requested by some case.
- Every route the isolated server registers must be in some feature's `reaches`, and every reach must be a registered route; the run fails on either gap. `scripts/dev-server-child.ts` lists the network and owner routes it saw Fastify register (GET, POST, PUT, PATCH and DELETE; HEAD is GET without a body) in the session manifest, which only the development fixture writes, and `summary.json` records them.

## Intent

`intended` behaviour was approved by the owner; change it only after agreeing the new behaviour. `observed` behaviour records what the server does today so a refactor cannot change it silently; it is not an endorsement. When an observed behaviour looks wrong, the case still asserts it and `feature-map/SURPRISES.md` names it. Fixing it means changing the server, the case and the surprise together.

## Adding or changing a feature

Write `behaviour` in domain language, cover the happy path and the main failure of every route the feature reaches (invalid input as the contract defines it, unknown IDs, conflicts; unauthenticated access is swept for every route of a feature that declares `paired: true`), run the feature, read its evidence, then run `--all`. Keep the fixture minimal: extend `scripts/dev-server-child.ts` only when a route cannot be reached from a case's setup.

On a host that cannot create a network namespace (GitHub's ubuntu runners), set `PORCELAIN_SANDBOX_NETWORK=host`: the sandbox keeps every other isolation and only the network namespace is dropped. CI does this and says so in its step names.
