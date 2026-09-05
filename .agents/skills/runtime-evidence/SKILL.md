---
name: runtime-evidence
description: Set up and validate Porcelain runtimes when the developer delegates runtime setup or validation, including a complete implementation-and-verification loop. Do not load for ordinary coding solely because the skill is available.
---

# Runtime evidence

Use this skill when the developer delegates runtime setup or validation, including a complete
implementation-and-verification loop. Choose the surfaces and checks relevant to the task, reuse
suitable environments, and stop once the agreed outcome is demonstrated.

Apply the procedures below and in the references only to that scope. A delegated full loop does
not require every platform or form factor. Once checks pass, repeat or broaden them only when
new changes, failures, or a concrete unresolved concern justify it.

This is a repository development skill. It does not configure the shipped companion plugin or
prescribe a Canvas workflow. Use [AGENTS.md](../../../AGENTS.md) for repository boundaries and
[development.md](../../../docs/development.md) for launch and rebuild guidance. Commands belong
to [package.json](../../../package.json), package-local scripts, and the linked launchers; inspect
their current interfaces instead of carrying command recipes or allocations between sessions.

For Codex-created or managed worktrees, parallel file ownership, integration checks, and checkout
cleanup, read [parallel-work.md](references/parallel-work.md) before allocating or changing runtimes.
For launch and interaction guidance, read only the reference for the selected surface:
[browser](references/browser.md), [Electron](references/electron.md),
[Android](references/android.md), or [iOS](references/ios.md).

## Choose validation

Prefer focused automated tests. When interactive validation is needed, use the browser for
behavior shared with the web client. Use Electron or a native mobile runtime when the behavior
depends on that platform, such as desktop window controls or native device features. Expand
validation only when the simpler method leaves a relevant question unanswered.

Run phone and tablet validation only when needed for the behavior or explicitly requested. Choose
one representative device when sufficient; use both form factors when layout or interaction
differences require it. Follow platform-specific behavior onto the platform it depends on.

## Establish ownership and readiness

Use an isolated development environment for the task. Reuse a suitable running environment when
its checkout and ownership are known. Start only the services and devices needed, and track
resources started by the task for cleanup. Use `pnpm dev:env` and the development launchers to
resolve profiles and ports; follow development.md for worktree setup. Never use production data
or credentials as fixtures.

Use the development launchers to manage profiles and ports. Avoid duplicate services for the
same environment. Track processes and devices started by the task, and leave resources owned
by others alone.

Before validating behavior, confirm the selected runtime is running the intended code and can
load the task's test data. If setup fails, report the blocker rather than treating startup alone
as a successful check.

## Coordinate evidence

When multiple agents share a runtime, assign one operator to each interactive surface.
Coordinate changes to shared services and devices.

Use available tools suited to the selected runtime and host. Follow their current instructions,
and confirm they support the interaction needed. Report missing capabilities rather than assuming
a tool can control a surface.

Prefer stable test IDs for automated interaction across all surfaces. When unavailable, use
semantic identifiers; use coordinates only as a last resort. Add test IDs where a tested
interaction needs a stable target. Refresh the UI hierarchy after navigation.

Define the expected outcome before checking a behavior. Use test data that makes incorrect results
easy to notice, and keep interactions within the task's scope.

Report what was checked, the observed result, and any unresolved issue. Save screenshots, logs,
or reproduction details when requested or when they help explain a failure or support continued
work. Keep saved evidence under `scripts/agent-scratch/<task>/`, with enough source and runtime
context to make it useful. A separate manifest is not required.

Keep credentials and personal data out of saved evidence. Report observations accurately,
distinguishing what was tested from what was inferred.

## Cleanup and handoff

Keep the environment available while the developer is reviewing or continuing the work. When
finished, clean up only task-owned temporary resources. Report any retained runtimes, how to
resume or stop them, and unresolved issues. Follow the developer's instructions for committing
or publishing.
