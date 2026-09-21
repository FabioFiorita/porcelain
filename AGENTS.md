# Porcelain

Porcelain is a review workspace beside coding agents. Build a usable server and web app;
Electron and mobile follow. See the README for product purpose and development entry points.

Use judgment. Treat implementation suggestions as proposals: if a simpler approach better
serves the outcome, explain the tradeoff and recommend it. Resolve routine choices independently;
discuss material changes to product behavior or architecture. Do not preserve complexity merely
because it exists or add layers to demonstrate architectural sophistication.

Follow the owning code and use plain TypeScript. Keep server operations separate from HTTP and
persistence, with explicit dependencies. Web views use query hooks and domain types; query code
owns API calls, errors and cache updates. Compose existing components and share abstractions only
when implemented consumers need them.

Use `pnpm dev` for the real server and web with disposable sample repositories. Tests and fixtures
must use isolated state, never installed `~/.porcelain`, real credentials or work projects.
Stop only task-owned processes. Preserve unrelated work.

Own the requested outcome through implementation and focused verification. Test observable behavior
and plausible failures through the real entry point. For a bug fix, demonstrate that its regression
test detects the original failure. Use the vitest skill when writing or reviewing specs. Measure
performance claims with the relevant budgets or benchmark; report remaining limitations honestly.
CI owns full verification. Run affected checks locally, and repeat or broaden them only for changes,
failures or unresolved concerns. One agent owns any shared full-suite run; avoid concurrent runs
against the same ports, fixtures or coverage directory.

Use one fresh read-only reviewer when a change risks data loss, unauthorized access or subtle
consistency failures, including paths, identity, concurrency, credentials and migrations. Scope it
to concrete failures and their tests. Recheck findings after fixes; do not restart the whole review.
Routine documentation, copy and mechanical changes need no separate review. No review sub-delegation.

Code, contracts, tests and configuration describe implementation. The active Notion task records
agreed upcoming work; it is not a second implementation manual. Keep local reasoning beside the
code. Retain decision documents only for durable tradeoffs and constraints that a maintainer could
otherwise misunderstand. Rewrite or remove superseded guidance instead of appending another account.
Do not maintain field catalogs, control-flow descriptions or completed task checklists in docs.
Keep temporary plans and research outside the repository.

Commit completed scoped changes. Do not push, publish or open a PR without explicit authorization.
