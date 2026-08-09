# Execution specifications

Specifications in this directory are recipes for execution agents. Accepted architecture decisions
and the integrated inventory contain the judgment; a specification contains no unresolved product or
architecture choice.

The ordered work breakdown is [`catalog.md`](catalog.md). A catalog row is not executable until its
full recipe exists and is marked Ready.

## Readiness and review gates

Recipe authoring and recipe execution are separate units of work:

1. An architecture reviewer checks a Draft against the current code, every accepted decision, and
   its landed dependencies. The reviewer replaces summaries with exact paths, symbols, wire shapes,
   deletion searches, test boundaries, and commands wherever an executor would otherwise need to
   choose.
2. Only that reviewer changes the recipe and catalog from **Draft** to **Ready**. Ready means all
   dependencies are already **Landed** and no product or architecture judgment remains.
3. An executor verifies the stated anchors still match before editing. A mismatch returns the unit
   to the reviewer; it is not permission to reinterpret the recipe.
4. The executor changes Ready to **Landed** in the same commit as the implementation only after all
   completion criteria pass.

Do not queue Draft recipes merely because their files are detailed. This deliberately limits
parallelism: dependency order and a trustworthy review boundary are more valuable than speculative
throughput.

## Executor contract

An execution agent:

1. reads the complete specification and every governing decision it names;
2. verifies its dependencies are landed and the listed current paths still match;
3. performs only the stated scope and ordered steps;
4. preserves named behavior and deletes named legacy behavior;
5. writes tests at the boundaries assigned by the specification;
6. runs every required validation command and captures truthful evidence;
7. removes all temporary scaffolding the specification introduces;
8. commits the bounded unit when every completion criterion passes;
9. leaves the worktree clean and reports the review packet below;
10. stops and reports a mismatch instead of inventing architecture, compatibility, waivers, or scope.

Execution agents do not add dependencies, public behavior, architecture exceptions, compatibility
paths, migrations, retries, fallbacks, or speculative abstractions unless the specification explicitly
requires them.

## Required review packet

Every executor's final report must let a fresh reviewer inspect the unit without chat history. It
contains:

- recipe ID, starting commit, final commit, and whether the worktree is clean;
- the exact files changed and a one-sentence reason for each group;
- each validation command actually run and its pass/fail/count result;
- every requested deletion search and its result;
- any mismatch, deviation, skipped check, warning, or assumption—`none` when there were none;
- confirmation that nothing was pushed and no later recipe was started.

The reviewer reads the committed diff from the reported starting commit through final commit,
compares it with current production return types rather than only legacy contract schemas, reruns
the risk-owning tests, and either accepts it or adds a narrow correction commit under the same recipe.
A correction never smuggles in the next recipe.

## Required shape

Every specification uses this structure:

```markdown
# <ID> — <imperative outcome>

- Status: Draft | Ready | Blocked | Landed
- Batch: <ordered batch>
- Domain: <canonical domain or supporting region>
- Depends on: <spec ids or none>
- Governing decisions: <decision links>
- Primary exemplar: yes | no

## Objective
One observable sentence describing what becomes true.

## Why this unit exists
The dependency or migration reason; no general architecture essay.

## Current behavior and evidence
Exact paths, names, callers, persisted data, tests, and traps verified from the inventory.

## Scope
Exact paths and responsibilities the agent may change.

## Non-goals
Adjacent work that must remain out of this unit.

## Target ownership and public surface
Exact target paths, exports, types, operation names, capabilities, contracts, and wire behavior.

## Behavior to preserve
Permanent product, resilience, security, performance, and platform behavior.

## Legacy behavior to delete
Exact compatibility paths, aliases, migrations, tests, and temporary scaffolding removed here.

## Ordered implementation
Numbered mechanical steps with no architectural branch.

## Tests
Exact behaviors, owning test boundaries, fixture strategy, and expected test paths.

## Validation and evidence
Exact commands, searches proving deletion, and runtime evidence required.

## Forbidden shortcuts
Known tempting violations specific to the unit.

## Completion criteria
Binary checklist proving the objective, target boundaries, deletion, tests, gates, and commit.

## Handoff
What the next dependent specification may now assume; no unplanned follow-up work.
```

## Size and dependency rules

- One specification produces one reviewable commit unless it explicitly names a small inseparable
  sequence.
- One executor session owns one specification. A correction may reuse that session; the next
  specification starts with fresh context.
- A specification should fit one execution agent context without relying on chat history.
- File movement and behavior change are separated when either can land and prove independently.
- A domain cutover may span several specifications, but the complete batch includes deletion of the
  legacy path before delegation begins.
- At most one specification owns a current file at a time within a parallel batch.
- Shared foundations land before domains that consume them.
- The first specifications are primary-agent exemplars; later agents copy their concrete conventions.
- No specification is marked Ready while one of its target types, paths, or failure semantics says
  “TBD,” “choose,” “as appropriate,” or an equivalent delegation of judgment.

## Review standard

The architecture reviewer checks every drafted specification against all accepted decisions, not only
the links selected by its author. A spec is rejected when it:

- preserves pre-launch compatibility without an accepted exception;
- creates a second transport, store, state owner, or application layer;
- hides required workflow steps behind operations, services, or events;
- imports another domain's internals;
- asks E2E to prove behavior owned below;
- uses mocks that reimplement production behavior;
- introduces a waiver without an exact accepted removal condition;
- leaves temporary scaffolding or legacy deletion to an unnamed follow-up;
- cannot state how an executor proves success from a clean target state.
