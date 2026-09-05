# Worktrees and parallel development

Use this reference when work needs isolation or coordinated contributors. It describes repository
development; it does not authorize creating user-visible Codex tasks, publishing, or deleting work.
The command authority is [worktree.mjs](../../../../scripts/worktree.mjs); inspect its current help
and [development.md](../../../../docs/development.md) when selecting commands.

## Select the checkout

Use the task's assigned checkout. Before launching, run `pnpm dev:env` to inspect its development
configuration. If the checkout needs setup, use the worktree tooling described in the
[development guide](../../../../docs/development.md). Use the tooling's current help for commands
and options.

## Coordinate changes and tools

Give each agent a bounded task and an assigned checkout. Coordinate edits to shared files and
dependencies before integrating work. Worktrees isolate source changes, but services and devices
may still be shared; follow the [runtime skill's](../SKILL.md) ownership guidance.

## Integrate and validate

Integrate dependent changes in order and check the combined result. Use the
[runtime skill](../SKILL.md) to choose appropriate validation. Rebuild or restart only when needed,
and report results against the integrated code.

## Remove only completed, owned resources

Remove a worktree only when its work is preserved and it is no longer needed. Use the worktree
tooling's supported removal command for that checkout. Preserve requested evidence and leave
other tasks' resources alone. Automatic checkout-deletion hooks are not general cleanup commands.
