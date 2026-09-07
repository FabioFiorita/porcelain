# Porcelain

Porcelain is a review workspace beside coding agents, not an IDE or agent runner.
Read [product scope](docs/product.md), [architecture](docs/architecture.md), and
[development](docs/development.md) before changing code. The current repository is a rebuild;
Git history is not a requirement to restore previous features.

## Scope and decisions

Implement the requested scope in small, explainable changes. Discuss new architectural boundaries,
product capabilities, or programming models before implementing them. Use plain TypeScript.
Follow owning code and configuration; do not introduce a competing pattern for convenience.
Record consequential choices in `docs/decisions`; keep task logs and temporary plans out of docs.

## Structure and safety

Organize by feature, use explicit dependencies, and keep platform APIs behind application adapters.
Tests use `.spec.ts` or `.spec.tsx`. New packages expose explicit public subpaths.
Do not duplicate server state in Zustand. Do not invent base classes, generic repositories, or a DI container.
Use disposable fixtures and isolated development state. Never run against production `~/.porcelain`,
real credentials, or real projects as development fixtures. Stop only task-owned processes.

## Verification

Run focused specs and changed-file lint/format checks locally, plus type checking of affected packages
and consumers of changed contracts. CI owns full verification; do not run the whole suite repeatedly.
A new/changed quality gate must be exercised locally, including proving it rejects a known violation.
Fix CI failures with the smallest reproduction. Never weaken a check merely to obtain green results.
Suppressions need a specific reason; skipped tests and unbounded `any` are not acceptable substitutes.

Each behavior change needs repeatable regression protection. Add user-workflow smoke coverage when
introducing a user-facing path. Browser proof does not establish Electron or native mobile behavior.
Report what actually ran and what remains unverified. Coverage and green checks do not guarantee correctness.

## Fresh review and delivery

For a coherent nontrivial change, use one fresh, read-only reviewer after focused checks pass.
Give it the requirements, diff, relevant architecture, and check results instead of the full conversation.
Bound review to correctness, architecture, regressions, and affected surfaces. No sub-delegation or
routine rerunning of successful checks. Findings must include a concrete failure scenario and location.
Resolve actionable findings; repeat review only for substantial fixes or unresolved issues.
Skip this step for trivial documentation/formatting edits. The reviewer may report no findings.

Preserve unrelated state. Commit coherent completed work. Do not push, open a PR, publish, or release
without explicit authorization. CI completion is only established by observing its actual run; a local
pass or a workflow file is not cloud proof.
