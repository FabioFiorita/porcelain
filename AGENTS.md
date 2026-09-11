# Porcelain

Porcelain is a review workspace beside coding agents, not an IDE or agent runner.
The current priority is a usable server and web app. Electron and mobile come later.
See [product intent](docs/product.md) and [decisions](docs/decisions) when relevant;
code and configuration own implementation details.

Follow the owning code and use plain TypeScript. Keep server operations separate from
HTTP and persistence, with explicit dependencies. In the web app, views use query hooks
and domain types; query code owns API calls, errors and cache updates. Compose the existing
shadcn components. Avoid speculative packages, frameworks and shared abstractions.

Use `pnpm dev` for the real server and web with disposable sample repositories.
Tests and development fixtures must use isolated state, never installed `~/.porcelain`,
real credentials or work projects. Stop only task-owned processes.

Carry authorized work through implementation and focused verification. Use reasonable
judgment for routine choices; discuss changes to product scope or major architecture.
Protect changed behavior with meaningful tests. CI owns full verification; run checks
proportional to the change locally and report what remains unverified.

For a nontrivial change, use one fresh read-only reviewer after focused checks pass.
Bound review to correctness, regressions and architecture, including whether tests protect
plausible failures. No sub-delegation or routine rerunning of successful checks.

Preserve unrelated work and commit completed changes. Do not push, publish or open a PR
without explicit authorization. Keep documentation short: intent, meaningful tradeoffs,
and contributor workflows, rather than descriptions of what the code already says.
