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

Organize server code by responsibility (`db`, `http`, `use-cases`, `repositories`, `git`). Nested
folders describe roles (`errors`, `interfaces`, `dtos`, `mappers`, `commands`), not product features. Use explicit constructor dependencies for Git,
repository, and use-case classes; keep pure rules and routes as functions. Use named errors for meaningful failure categories and preserve external causes.
Do not create `index.ts` or equivalent JavaScript/TypeScript index modules; use descriptive filenames
and explicit imports instead of directory barrels.
Tests use `.spec.ts` or `.spec.tsx`. New packages expose explicit public subpaths.
Prefer `const` and explicit return values over mutable local variables. Return related outcomes together
instead of initializing variables and assigning them across branches. Keep mutation limited to justified
local collection building and lifecycle state; do not introduce abstractions merely to eliminate it.
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

Tests must protect an explicit product requirement, supported contract, or concrete failure scenario.
Assert meaningful outcomes, not incidental implementation choices or merely the absence of old behavior.
A refactor preserving the contract should not require rewriting assertions. Assert internal details only
when they are themselves a documented compatibility boundary. Do not add tests just to increase coverage
or mutation scores, or preserve obsolete development iterations without a supported upgrade requirement.

## Fresh review and delivery

For a coherent nontrivial change, use one fresh, read-only reviewer after focused checks pass.
Give it the requirements, diff, relevant architecture, and check results instead of the full conversation.
Review added and changed tests for value before committing: identify the failure each protects,
flag implementation-mirroring assertions and unnecessary historical compatibility, and check that the
test would fail for a plausible defect. Mutation scores alone do not establish test usefulness.
Bound review to correctness, architecture, regressions, and affected surfaces. No sub-delegation or
routine rerunning of successful checks. Findings must include a concrete failure scenario and location.
Resolve actionable findings; repeat review only for substantial fixes or unresolved issues.
Skip this step for trivial documentation/formatting edits. The reviewer may report no findings.

Preserve unrelated state. Commit coherent completed work. Do not push, open a PR, publish, or release
without explicit authorization. CI completion is only established by observing its actual run; a local
pass or a workflow file is not cloud proof.
