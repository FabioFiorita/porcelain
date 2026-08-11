---
name: execute-architecture-spec
metadata:
  internal: true
description: Execute exactly one reviewer-approved Porcelain architecture-refactor recipe and leave a self-contained review packet. Use when the human asks Claude, Codex, or Grok to continue the architecture refactor, run the next spec, execute the next Ready or dependency-eligible Queued recipe, or land one migration unit from plans/architecture-refactor/specs.
---

# Execute Architecture Spec

Land one bounded recipe without inheriting chat context or making architecture decisions.

## Select the unit

From the repository root, run:

```bash
node .agents/skills/execute-architecture-spec/scripts/next-ready.mjs
```

The script requires a clean worktree, validates the recipe catalog, and prints the only executable
recipe plus the starting commit. Executable means Ready, or Queued with all dependencies now Landed.
If it reports zero or multiple candidates, stop and return that result. Never choose or promote a
Draft/Blocked recipe, or continue a previous agent's dirty work.

One invocation owns one recipe. Never begin the next recipe in the same session — unless the
human explicitly started a campaign under "Single-orchestrator campaign mode" in
`plans/architecture-refactor/specs/README.md`; in that mode the same session promotes one Draft,
executes it, and loops, with all other rules in this skill unchanged per unit.

## Rebuild context from the repository

1. Read root `AGENTS.md`, `plans/architecture-refactor/specs/README.md`, and the selected recipe in
   full.
2. Load `ship`. Load any other project skill only when its trigger matches the selected work.
3. Read every governing decision and dependency named by the recipe.
4. Inspect every current production path and symbol named under Current behavior and evidence.
   Treat runtime routers, implementation return types, persistence, and callers as evidence; do not
   assume a legacy schema is authoritative.
5. Inspect the closest landed domain exemplar named by the recipe or evident from its dependencies.
6. Compare those facts with the recipe before editing. Stop with exact file/symbol evidence if a
   path vanished, a dependency is not Landed, behavior differs, scope overlaps unrelated changes,
   or any implementation choice remains unresolved.

Do not ask the human to restate information already available in these sources.

## Execute the recipe

1. State what will become true and which checks prove it.
2. Change only the selected recipe's scope, following its ordered implementation and landed idiom.
3. Preserve every named behavior and remove every named legacy path. Add no dependency, fallback,
   compatibility path, waiver, retry, abstraction, or public behavior unless the recipe requires it.
4. Test at the lowest boundary that owns each risk. Use synthetic fixtures without personal machine,
   user, repository, token, or company context.
5. Run every recipe validation command, then `pnpm lint`, `pnpm verify`, and `git diff --check`.
   A warning or skipped check belongs in the review packet; never describe it as a clean pass.
6. Re-read the complete diff against the recipe and current runtime types. Check strictness,
   optionality, nullability, defaults, output shapes, deletion searches, file ceilings, and
   dependency direction as applicable.
7. Change the selected Ready/Queued recipe and catalog row to Landed only after every completion
   criterion passes.
8. Commit the complete unit once using the repository commit convention. Do not push.
9. Confirm the worktree is clean and stop.

Objective test, lint, type, build, or documentation defects inside the recipe's scope are part of
the unit. A product choice, architecture fork, scope expansion, dependency addition, destructive
cleanup, or mismatch with the recipe is a stop condition.

## Return the review packet

Return exactly the durable facts required by `plans/architecture-refactor/specs/README.md`:

- recipe ID, starting commit, final commit, and clean-worktree status;
- changed file groups and why each changed;
- every command actually run with pass/fail and counts where available;
- every requested deletion search and its result;
- mismatches, deviations, skipped checks, warnings, and assumptions, or `none`;
- confirmation that nothing was pushed and no later recipe was started.

Do not end with “should work,” recommend executing the next Draft, or hide a partial result behind a
success summary.
