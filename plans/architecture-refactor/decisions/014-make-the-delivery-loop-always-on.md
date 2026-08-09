# 014 — Make the delivery loop always-on

- **Status:** Accepted
- **Accepted:** 2026-08-09

## Context

Porcelain's root `AGENTS.md`, internal Ship skill, Audit skill, and shipped Porcelain Companion skill
overlap and sometimes contradict one another. Root instructions already require intent, execution,
proof, gates, and a commit. Ship repeats that loop and also repeats commands, autonomy, worktree,
testing, and commit guidance owned elsewhere. Ship says a Porcelain Review is optional, while the
Companion skill currently requires every session to clear, create, and complete one.

Audit contains important earned invariants, but agents must remember to load a generic router before
touching broad categories of files. The target domain architecture gives those invariants clearer
permanent owners and can mechanically enforce many of them. Deleting the skill before relocating its
unique knowledge would discard the reasons behind security, persistence, Git, performance, and
packaging behavior.

This is a target-state decision for the architecture migration, not authorization to interrupt the
decision and inventory phases with immediate skill rewrites.

## Decision

The intent-to-commit delivery loop becomes always-on agent identity in root `AGENTS.md`; Ship retires
after its unique procedures move to their owners; Audit retires only after every invariant is assigned
to domain documentation, enforcement, tests, or a focused procedure; and Porcelain Companion remains
an explicit product-surface skill rather than a mandatory session lifecycle.

## Always-on delivery loop

Every implementation session follows this loop without loading a skill:

1. Understand the intention, current behavior, accepted architecture, and owning domain.
2. State what will become true and how the result will be proved.
3. Resolve meaningful architecture or product choices before implementation.
4. Implement through accepted boundaries and local idiom.
5. Test each behavior at the boundary that owns its risk.
6. Produce proportional runtime evidence when behavior is user-visible or integration-sensitive.
7. Update durable documentation or mechanical enforcement when current truth changes.
8. Run the required gate and commit the completed unit.
9. Stop before push or another outward-facing action unless the human authorized it.

The loop scales ceremony to risk and scope. Proof never means “should work,” but it also does not
require creating a product Review or screenshot for a documentation-only unit whose relevant proof is
a documentation gate.

## Ship retirement

Ship is removed after its surviving responsibilities have explicit owners:

- the default loop and autonomy boundaries live in root `AGENTS.md`;
- the accepted testing model moves to current contributor documentation when implemented;
- commit syntax and branch policy remain machine-enforced;
- verification commands remain in root instructions and package scripts;
- browser proof belongs to the Web E2E procedure;
- mobile proof belongs to the Mobile procedure;
- release work belongs to Releasing;
- worktree mechanics live in focused command help or a worktree procedure if detail remains useful.

The migration inventory must identify any unique Ship statement before deletion. Duplication is
removed rather than copied wholesale into `AGENTS.md`.

## Audit invariant relocation

Audit as a generic skill can retire; security and correctness reasoning cannot. Its current material
is distributed by ownership:

| Current invariant area | Target owner |
|---|---|
| Authentication, CORS, pairing, LAN, Tailnet, Funnel | Remote domain |
| File limits, safe paths, and watcher bounds | Files domain |
| Git environment, locks, status, and staging behavior | Git domain |
| Agent-authored HTML, Review paths, and evidence sandbox | Review domain |
| Saved-command visibility and machine-local trust | Actions domain |
| Atomic storage, corruption handling, and data disposition | Project Data domain |
| PTY environment, attachment, scrollback, and cleanup | Terminal domain |
| Daemon process and Electron boundary | Daemon/Desktop internals |
| Viewer virtualization and large-project behavior | Viewer internals |
| Native modules, signing, and bundle layout | Desktop packaging and Releasing |

For every invariant:

- an objective rule becomes a lint, type, contract, or test where reliable;
- enduring rationale moves to current documentation owned by the domain or supporting region;
- migration-sensitive requirements are copied into the exact execution specifications that can
  violate them;
- operational procedure stays only in the narrow skill that performs that operation.

Audit and `docs/internals/audit/` are deleted only after an inventory proves no unique invariant or
rationale remains. New external boundaries still require explicit threat and failure analysis in
their architecture decision and specification; removing the generic skill does not waive that work.

## Porcelain Companion

Porcelain Companion remains the procedure for agents intentionally interacting with Review, Board,
comments, reviewed marks, Actions, notes, scope, layers, evidence, or project companion data.

Its target trigger and lifecycle change:

- it does not create or clear a Review merely because a session began;
- it never clears another human or agent's active Review automatically;
- a Review is authored when the human requests it or the unit is intentionally being published for
  human review;
- the always-on delivery loop applies whether or not a product Review is authored;
- repository plans and architecture records remain in the repository documentation tree rather than
  being duplicated automatically into Review;
- Review Evidence is user-facing proof and narrative, not an internal bookkeeping side effect of
  every edit.

The skill remains comprehensive for the product surfaces it teaches. Only its automatic trigger and
mandatory session lifecycle are narrowed.

## AGENTS.md scope

Root `AGENTS.md` contains identity, the concise delivery loop, product/runtime boundaries, escalation
rules, and pointers to current enforcement. It does not absorb detailed browser, simulator,
packaging, release, or product-surface manuals.

This preserves the existing rule: always-on instructions describe how agents behave; skills describe
focused procedures; objective rules belong to gates.

## Rationale

- Every agent follows the delivery loop without depending on trigger recognition.
- Removing Ship eliminates duplicated procedural memory and contradictory Review semantics.
- Audit knowledge gains durable product and mechanical owners instead of disappearing.
- Specialized skills remain focused and load only when their procedure is actually needed.
- Architecture discussions and documentation work stop mutating the active product Review by
  default.
- Root instructions remain concise enough to be useful in every session.

## Rejected alternatives

- **Keep Ship as the loop trigger.** An always-required behavior should not depend on optional skill
  loading, and most of Ship duplicates other owners.
- **Delete Audit immediately.** Unique threat, data, performance, and packaging knowledge would be
  lost before the target architecture protects it.
- **Assume architecture eliminates audit reasoning.** New trust boundaries and irreversible effects
  still require explicit analysis even in clean code.
- **Move every skill into AGENTS.md.** Always-on context would become a long manual and focused
  procedures would load for irrelevant work.
- **Require a Porcelain Review every session.** Product state is mutated for internal bookkeeping,
  concurrent work collides, and planning documents are duplicated.
- **Remove Porcelain Companion entirely.** Agents still need a precise manual when intentionally
  operating Review, Board, Actions, comments, scope, and other companion surfaces.

## Consequences

- Agent-foundation migration becomes a bounded workstream after architecture inventory and ordering.
- The Audit invariant inventory is a prerequisite for deleting either the skill or audit doc tree.
- Root `AGENTS.md`, authored skills, agent-foundation sync checks, and skill-command lint change in a
  coordinated specification.
- Current skills remain in place during the decision and inventory phases.
- The target testing and domain documentation must ship before their corresponding Ship or Audit
  text can be removed.
- Companion lifecycle changes must propagate to its canonical authored source and generated or
  installed adapters through the existing foundation sync path.

## Enforcement and proof

Agent-foundation checks must prove canonical sources and host adapters remain synchronized, removed
skills are no longer referenced, every documented command exists, and root instructions contain one
unambiguous loop. Documentation lint must prove every relocated invariant has one current owner.

The migration is complete only when Ship and Audit contain no unique knowledge, both are removed,
the Companion skill no longer mutates Review automatically, and representative agents can discover
the default loop from `AGENTS.md` without loading a skill.
