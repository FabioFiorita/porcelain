# Durable walkthrough writing

The contract is `packages/contracts/src/walkthroughs/api.ts`. All three routes require the paired fixture credential and its Origin.

1. Commit a small fixture change on a branch and keep its base branch. POST `/api/worktrees/:worktreeId/walkthrough` with `{ "base": "refs/heads/main" }`. The response is the durable run, initially queued. Repeat the same request while the attempt is queued, running or ready: the id must match and no second writer may start. After a failed attempt, an explicit start creates a new attempt; concurrent presses share that new attempt. Earlier failures remain stored.
2. GET the same path to observe the latest attempt, running then ready content or a failed state with a plain message. Subscribe to the worktree live channel: changes use `type: "walkthrough", change: "run"`.
3. Make a new commit. GET reports `outOfDate: true`; the retained walkthrough keeps its original base/head. Starting at the new head queues a new run.
4. Existing PR evidence is addressed by GET `/api/worktrees/:worktreeId/walkthrough/:runId/assets/:assetId`; verify its media type and exact bytes. A missing asset or an asset belonging to another run returns the declared 404 JSON error, `Walkthrough evidence asset not found`. No PR means no PR evidence.
5. PR attachment images may redirect: follow at most five HTTPS redirects, checking every destination against the GitHub image allowlist before requesting it. Disallowed destinations must never be fetched.
6. Both writer passes exclude inherited MCP/plugin tools and repository hooks. Codex progress is separate from the final answer file; prose progress must not reject valid final output.
7. Stop and reopen the application with the same disposable database while a writer is active. Running work becomes failed with an interruption message, queued work is dispatched, finished content and evidence remain readable. Shutdown drains the writer process group before persistence closes.

Run `apps/server/spec/integration/walkthroughs.integration.ts` and `apps/server/spec/integration/walkthroughs-restart.integration.ts` through the integration runner, then `apps/server/src/runtime/walkthrough-workflow.spec.ts`, `apps/server/src/adapters/walkthroughs/filesystem-transcript-reader.spec.ts`, `apps/server/src/adapters/walkthroughs/github-evidence-reader.spec.ts`, `packages/agents/src/walkthrough-writing/cli-walkthrough-writer.spec.ts`, `packages/walkthroughs/src/rules/qualify-walkthrough.spec.ts` and `packages/storage/src/db/migrate.spec.ts` by name. They use fake CLI executables, real SQLite and real Git for durable execution, filtering and qualification.

The default sandbox intentionally has no installed agent, sign-in or network. A real writer proof needs the host CLI through a bounded, owned verification bridge, using a public Porcelain change and the same read-only flags. Retain timing and cost from the ready state; never copy transcripts or credentials to evidence.

The walkthrough integration spec uses the built server and real SQLite, reaches all three walkthrough routes with valid credentials, and passes their actual validated-handler log through the unchanged route-coverage guard. This focused check establishes coverage of these routes; the global teardown guard is judged only by a full integration run.
