# Execution specifications

Specifications in this directory are recipes for execution agents. Accepted architecture decisions
and the integrated inventory contain the judgment; a specification contains no unresolved product or
architecture choice.

The ordered work breakdown is [`catalog.md`](catalog.md). A catalog row is not executable until its
full recipe exists and is marked Ready.

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
9. stops and reports a mismatch instead of inventing architecture, compatibility, waivers, or scope.

Execution agents do not add dependencies, public behavior, architecture exceptions, compatibility
paths, migrations, retries, fallbacks, or speculative abstractions unless the specification explicitly
requires them.

## Required shape

Every specification uses this structure:

```markdown
# <ID> — <imperative outcome>

- Status: Ready | Blocked | Landed
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
