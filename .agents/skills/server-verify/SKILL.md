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

`negative/` holds features written the way the net must not accept, in the same format: `hollow` is the audit's five hollow patterns and `disguised` hides the same holes behind real-looking code. `--all` runs them after the features (or name one), each on its own server, and prints `REJECTED` only when every case made assertions, threw nothing and every assertion was weak; otherwise the run fails and names the assertion that counted. They count toward no total and no route. When the net learns to reject a new hollow pattern, add it here.

The command prints one line per feature, each failure under it, and the evidence folder. It exits 1 when any assertion fails or is weak, a case throws or makes no assertion, a request's status or body was never asserted, a declared route was never requested, the isolated server fails to start or stop, a feature made no assertion, or a negative feature was not rejected; it exits 2 on usage errors. Read the evidence before reporting. `<folder>/<feature>.json` (a negative feature's is `negative.<feature>.json`) holds the feature's intent, behaviour, reaches, counts, failures and durations, and for every case, in order and each tagged setup, request or follow-up, its steps: HTTP exchanges with the request (method, path with query, headers with credentials redacted, body) and the response (status, headers other than date, connection, keep-alive and content-length, body); host Git commands with their whole argument list and output or error; file writes and reads with their byte counts; symbolic links, FIFOs, removals and renames; folder listings with the names they found; and live connections with the messages sent and received and how they closed. Beside the steps each case holds every assertion with its expected and actual values, its sources and, when weak, why; the error it threw or the requests it left unasserted; its duration; and what the server wrote to standard error while it ran. The feature ends with the server's whole standard output and standard error. `<folder>/summary.json` totals the run, lists the registered routes and what reached them, and records each negative feature and whether it was rejected. Every case records its wall time (`durationMs`, setup to last assertion), every feature its own and its cases' (`durations`), and the run prints and records its ten slowest cases; they are numbers to read, not limits. A pass verifies only the cases in the evidence.

Secrets never reach evidence or output, however short. The run collects every secret the session issued or sent: the paired credential, every credential and pairing code by its form (`pcd_…`, `pcp_…`) and every value of a `credential`, `code`, `link`, `signature`, `token` or `secret` field, every signed summary link with its token and signature, every bearer credential and cookie a case sends, and every cookie the server sets. It looks for them in every request and response body (JSON or raw), path and header, every live notice, Git's output, file contents and the server's output, then walks the whole evidence and replaces each one, and its URL-, HTML- and JSON-escaped forms, with `[redacted]`. A feature whose evidence would still hold a secret is not written; the run fails and says so.

## Fixture

The isolated server starts with one registered Git repository whose README.md is committed once and then changed without staging, one paired device whose bearer credential is the default for requests, and a web root holding the web shell, one hashed asset and a symbolic link that leads out of it. `scripts/dev-server-child.ts` writes what it created into the session manifest, and a case reads it from `session.fixture` (folder names, branch, device label and platform, the README's path and its committed and changed text, the initial commit's subject, the web root's files, the summary link lifetime, the Git action deadline, the catalog staleness window and the fake coding tool's command and replies); it never types those values again. A case discovers IDs from `session.projectId` and `session.worktreeId`, and takes values the server computes (fingerprints, status tokens) from a read and values Git computes (object IDs, patches) from `session.git(...)`. A case that needs more history or files creates them in its setup with `session.git(subcommand, ...args)`, `session.writeFile(...)`, `session.symlink(target, path)`, `session.fifo(path)`, `session.remove(path)` and `session.rename(from, to)`, which act on the sample repository from the host with fixed author and dates and are each recorded as a step; `session.readFile(path)` and `session.entries(path)` observe it (a listing may name the project home, `..`, but nothing above it). A case changes the host only through these helpers and `session.installCodingTool()`. `session.git` always runs `git -C <sample repository> <subcommand> ...args`: it refuses `-C`, `--git-dir`, `--work-tree` and `--namespace`, and any absolute path outside the project home, so the session, not the case, decides the repository; `session.rename` moves an entry within the project home. The owner socket (`target: 'owner'`) is reachable from the host.

The fixture overrides four limits of the server's settings in `scripts/dev-server-child.ts`, and nothing else:
- the inventory refreshes every 250 ms instead of every 30 seconds, so a case that changes a repository on disk waits with `eventually` until the inventory shows it;
- signed summary links expire after 2 seconds instead of an hour (`session.fixture.summaryLinkLifetimeMs`), so a case can watch one expire;
- a Git action's deadline is 1.5 seconds instead of two minutes (`session.fixture.gitActionDeadlineMs`), so the interrupted-action case settles in seconds;
- a catalog entry is stale after 200 ms instead of a minute (`session.fixture.inventoryStaleAfterMs`), below the 250 ms inventory refresh, so worktree reads regularly find their entry stale and go through the refresh before answering.

The review tools are reached with `toolCall(session, id, tool, input)` on the owner socket; `toolValue(body)` parses a tool's JSON answer, which counts as part of the body.

The server starts with no coding command-line tool on its PATH. A case that needs one calls `session.installCodingTool()` in its setup, which links the fixture's fake coding tool, built from `scripts/dev-coding-tool.ts`, into the sandbox's PATH folder as `claude`, where it stays for the rest of the feature; it is recorded as a step. The server finds and runs it as it would the real CLI: it lists the Claude models, and the tool reads the prompt from standard input and answers in the Claude CLI's JSON envelope, whose structured output is `session.fixture.codingTool.message` for a prompt that asks for one message and `session.fixture.codingTool.groups` for one that asks for a sequence of commits, whatever the selection. It fails like the real CLI for an unknown option, a missing print mode, JSON output or JSON schema, a model other than `sonnet` or `haiku`, and a prompt that asks for neither. So a case that asks for the fixture's replies selects exactly their paths, and one that selects anything else proves the server's refusal. A feature that needs the refusal for a missing tool asserts it before any case installs the tool.

The run bundles `scripts/dev-server-child.ts` and the fake coding tool with esbuild once, with the native packages it cannot bundle beside it and the migrations, and every isolated server runs that build. The sandbox mounts only the built server (at `/opt/porcelain/server`), the node and git binaries with Git's exec path and templates, the shared libraries those binaries and the native addons load, its PATH folder and the fixture folder; never the checkout, a shell or the rest of `/usr`. It runs in its own session, network, PID and IPC namespaces and dies with its parent; the host reaches the network listener at the same address through a relay over a Unix socket in the fixture folder, and the owner socket directly. The sandbox's PATH is one host folder, mounted read-only, holding a symlink to git and nothing else until a case installs the fake coding tool there, so no commit-model tool on the host ever reaches it. Without `/bin/sh`, through which Git reaches a local-path remote, and without a network, fetch, pull and push are verified up to the point where Git would contact the remote; no case needs more. The host's `session.git` runs without system or global configuration and with `core.hooksPath=/dev/null`, like the server's Git in the sandbox, and `session.writeFile`, `readFile`, `symlink`, `fifo`, `remove`, `rename` and `entries` resolve real paths, so a symbolic link cannot lead them out of the sample repository or, for `rename` and `entries`, the project home.

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
- `expect` asserts in code with `check` (deep equality), `checkPartial` (every key in the expected value matches), `checkContract` (the value satisfies a schema exported from `@porcelain/contracts/<area>`), `checkMatch` (a string matches a pattern) and `checkDiffers` (a value moved away from one observed earlier). Follow-up reads in `expect` are recorded as follow-up steps.
- An assertion counts only when its actual value was taken from something the harness observed: a response's status, headers or body (or a part of it: a nested value, a list's length, the keys of an object), a live notice, a Git command's output, a file read with `session.readFile` or a folder listed with `session.entries`. A string counts only when it is a whole observed value (a Git command's output and a file's content also count trimmed and line by line); a slice of one is weak, so assert its shape with `checkMatch`. A value the case computed, such as a comparison or `typeof`, is weak, and so is a boolean the case computed beside observed values. The expected value must be independent of the response it checks: the same object, an object inside it, or a value read from that response for the assertion is weak, while a value observed in another exchange (a setup read, an earlier request) may be expected. An expected value that is a bare boolean or `{}` and a partial that holds `{}` are weak; `checkContract` with a schema that is not itself exported from `@porcelain/contracts`, derived ones included, is weak; `checkDiffers` is weak unless the value it must differ from was observed in an exchange before the one that produced the actual value. A weak assertion fails the case and counts toward nothing. The evidence names each assertion's sources and, when it is weak, why.
- Every response the case requested must have its status and its body asserted; a case that leaves either unasserted fails, naming the request. Reading a property is not asserting it.
- Setup reads go through `read(session, request, status?)` (or `session.read`), which fails the case unless the answer has that status (200 by default); a setup that calls `session.send` fails. A follow-up request either goes through `read` or has its status asserted.
- `paired: true` puts every route in `reaches` into the `access.authentication` sweep, which refuses each one without a credential; there is no other list of paired routes.
- `session.live()` opens `/api/live` as the paired viewer; `upgradeHeaders(address)` probes its rejections over plain HTTP.
- Every route in `reaches` must be requested by some case and answered; a request that never got a response, or a live connection that never opened, reaches nothing.
- Every route the isolated server registers must be in some feature's `reaches`, and every reach must be a registered route; the run fails on either gap. `scripts/dev-server-child.ts` lists the network and owner routes it saw Fastify register (GET, POST, PUT, PATCH and DELETE; HEAD is GET without a body) in the session manifest, which only the development fixture writes, and `summary.json` records them.

## Intent

`intended` behaviour was approved by the owner; change it only after agreeing the new behaviour. `observed` behaviour records what the server does today so a refactor cannot change it silently; it is not an endorsement. When an observed behaviour looks wrong, the case still asserts it and `feature-map/SURPRISES.md` names it. Fixing it means changing the server, the case and the surprise together.

## Adding or changing a feature

Write `behaviour` in domain language, cover the happy path and the main failure of every route the feature reaches (invalid input as the contract defines it, unknown IDs, conflicts; unauthenticated access is swept for every route of a feature that declares `paired: true`), run the feature, read its evidence, then run `--all`. Keep the fixture minimal: extend `scripts/dev-server-child.ts` only when a route cannot be reached from a case's setup.
