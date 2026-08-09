# Architecture refactor — agent foundation and clean-cutover inventory

**Status:** inventory evidence for the architecture-refactor decision program. This records current foundations and target dispositions; it is not implementation authorization.

**Inventory date:** 2026-08-09.

Basis: architecture-refactor README and accepted decisions 001–015; root and nested AGENTS.md;
Ship, Audit and all six audit docs; shipped Companion; hooks, package scripts, migrations; and
implementation/test/comment hits for migration, legacy, deprecated, compatibility, alias and fallback.

This is planning, not authority to reset or delete human data. Decision 015 supersedes earlier
pre-launch stability clauses: historical formats and aliases are migration inputs; real operating
failure, recovery and safety remain.

## Target foundation

    Root AGENTS.md:
      intent → boundaries → implement → owned-risk test → proportional evidence
      → docs/enforcement → required gate + commit → stop before push
    Focused procedures: web-e2e, mobile, releasing, worktree help/procedure
    Product procedure: porcelain-companion only when intentionally operating companion surfaces
    Durable rules: domain/supporting-region docs + tests + lints/contracts
    Mechanical gates: git-guard/husky + pnpm lint + pnpm verify + CI

Current conflict: Ship says a Review is optional; Companion requires every session to clear,
create and complete one. Decision 014 keeps the Review optional and makes the delivery loop
always-on in root instructions.

## Ship responsibility relocation

| Ship responsibility | Current sources | Target owner / cutover |
|---|---|---|
| Intent-to-commit loop, proportional evidence, stop before push | Ship; partial root guidance | Root AGENTS.md: add concise Decision-014 nine-step loop, then delete Ship duplicate. |
| Autonomy: objective fixes; escalation of scope/dependency/architecture/push | Ship and root instructions | Root AGENTS.md, one authority. |
| Lint/verify commands and escape hatches | Ship; root; package.json; Husky; git guard | Root instruction; scripts/hooks remain authority. |
| Commit format | Ship; commit-msg hook; lint-commit-message | Commit-message lint plus concise root pointer; delete duplicate manual. |
| Branch/worktree mechanics | Ship; root; hooks; worktree script; Companion worktree reference | Root retains isolation decision; focused CLI help/procedure owns mechanics. |
| Browser proof | Ship; desktop AGENTS.md; web-e2e | Web-E2E procedure: browser against dev daemon, never production/installed app. |
| Mobile proof/fingerprint | Ship; mobile AGENTS.md; mobile | Mobile procedure and nested mobile instructions. |
| Backend/pure test model | Ship; package scripts; Decision 011 | Current contributor/testing docs and each migration specification. |
| Dev-only homes, ports, playground | Ship; root prod/dev table | Root AGENTS.md, already mostly canonical. |
| Release | Ship; releasing | Releasing procedure, root trigger only. |
| Optional Review publication | Ship vs Companion | Shipped Companion: human-requested or intentionally published Review only. |

Ship removal test: every row has a live owner; no Ship skill/adaptor/reference remains; a new agent
discovers loop, gate and proof surface from root plus the relevant focused procedure.

## Audit invariant relocation

| Audit area | Permanent owner | Preserve as / proof / target gap |
|---|---|---|
| Daemon-only OS/Git/FS, read limit/stat, no user-repo writes, dev playground | Files plus daemon internals | Files capability docs, adapter/operation tests, daemon-only host-capability import rule. |
| Loopback/LAN/Tailscale listeners and Funnel | Remote | Remote threat/failure docs, adapter tests, listener-construction ownership gate. |
| HTTP/WS auth, token scopes/revoke, secret handling, CORS/static/pairing | Remote; Review for CSP consequence | Contract/integration tests and public-error/redaction proof; URL lint is only partial. |
| PTY environment scrub | Terminal | Terminal adapter docs and terminal-env test; every daemon-only env classified. |
| Atomic JSON, corruption backup, serialized RMW | Project Data | Versioned strict root schemas, storage adapter tests and explicit corruption disposition. |
| Hidden-path filtering | Files | Main-boundary test and public Files DTOs. |
| Git env scrub/locks/status, no auto-stage, quick whitelist, -uall | Git | Git adapter docs/tests; carry lint-audit checks to Git-target gate. |
| Dependency-free/no-listener CLI and channel atomicity/ownership | CLI support; Review/Board/Actions/Files/Project Data | Node-builtins/no-listener tests and per-domain v1 channel schemas. |
| Review containment, escaped prose, sandboxed active content, CSP, Evidence caps | Review | Active-content threat model plus containment/iframe/CSP tests and robust static checks. |
| Human-visible human-run Actions and local command-text trust | Actions; Terminal executes | No CLI run, full command, visible PTY and machine-local fingerprint tests. |
| Regex compile-on-read, reviewed reconciliation | Review | Current external-data resilience tests. |
| CLI boot install | CLI plus daemon/desktop internals | App + daemon boot calls; atomic/chmod proof; no agent-host config writes. |
| tRPC transports, no raw data IPC, component transport boundary | Daemon/Desktop plus client-runtime/Web/Mobile | Architecture docs and import graph gate. |
| utilityProcess lifecycle | Daemon/Desktop | Packaged one-daemon and restart proof. |
| WS detach/reject/reconnect and 64KB scrollback | Terminal plus session support | Stream contracts and session/scrollback tests. |
| Virtual viewer, lazy tree, Vite prebundle | Viewer/Web build support | Performance docs and focused tests/config review. |
| Git cache/live queries; bounded nonrecursive watchers | Git plus Files | Caps/debounce/.git filtering/recovery tests under Decision 009. |
| Native dependencies/signing/asar | Desktop packaging plus Releasing | Packaging procedure, smoke/artifact tests, trash-packaging test. |

Audit removal test: every row has an indexed current owner and appropriate test/gate; audit-only
tests/gates are renamed or moved; no instruction asks agents to load Audit or cites audit docs.

## Companion cutover

Retain shipped porcelain-companion SKILL.md, references, check-evidence.mjs and version sync. It
remains the explicit procedure for Review, Board, Actions, comments, reviewed marks, notes, layers,
scope, evidence and project-companion data.

Rewrite its mandatory lifecycle:

- Remove automatic review clear/review set from When → what, Standing rules 1/4 and Lifecycle.
- Never clear another active Review automatically.
- Create/clear a Review only at human request or for an intentionally published review unit.
- Run check-evidence.mjs before claiming a published Review complete, not for every edit.
- Delete its home-to-project migration guidance with that migration; retain deliberate current-format
  environment seeding if it remains product behavior.

## Classification key

Delete = historical compatibility/name/reader/test.
Resilience = genuine supported runtime failure/recovery/safety.
Product default = intentional current-format initial or display behavior.
Temporary scaffolding = bounded workaround with a named removal specification.

## Historical data/channel/layout: delete

| Exact location family | Behavior and deletion |
|---|---|
| apps/daemon/src/project/migrate-home.ts and migrate-home.test.ts; router/repos.ts; imports in board/actions/comments/layers/notes/reviewed/review/scope/feature-snapshot stores | Delete one-way home channels and loop-evidence to project migration, memo, marker and every ensureProjectCompanion call/test. First establish clean v1 roots and separately authorize export/back-up/reset; never silently delete human material. |
| apps/daemon/src/project/migrate-active-review.ts, test, migrate-home call | Delete flat root to active-review mover and tests. Target reads one current v1 path only. |
| action-trust-store.ts trustMigratedCommands | Delete grandfathered trust with home migration; retain explicit machine-local human acceptance. |
| project-porcelain.ts migrated-from-home ignore; review-watch migration-shell coupling; Companion sync-environments migration section | Delete migration artifacts/comments, but retain never-create-a-missing-repo safety. |
| fs/evidence-paths.ts loopEvidenceRoot, re-export and scripts/worktree.mjs old home readers | Delete legacy evidence-home path/readers. |
| review-store.ts reviewSetsPath no-arg alias; scope-store.ts resolveScopePath deprecated alias | Delete aliases when callers are canonical. Relative-to-absolute display conversion is current behavior, not migration. |
| mobile environment.ts missing icon default and box-to-desktop preprocess; tests | Delete historical coercions. Target Remote root is strict v1 and rejects incompatibility clearly. |

## Historical Evidence shape/wire: delete atomically under Review

| Exact location family | Behavior and deletion |
|---|---|
| apps/cli/src/evidence-file.ts and test | Delete root evidence index.html reader/test; retain current checks/meta, results and assets. |
| apps/daemon/src/stores/evidence-store.ts and tests | Delete root-index fallback, hasReport, legacy presence/mtime and deprecated required medium field. Retain caps, containment, checks-only presence, mtime freshness and htmlUnavailable as resilience. |
| apps/daemon/src/review/doc-set.ts and tests | Delete loose evidence-root docs/root report merging and legacy labels. Retain current Intent/doc-set containment, caps and unique labels. |
| contracts procedures/refined; mobile daemon procedures/review; Web/mobile Evidence hooks and panels | Delete deprecated fields/local mirrors together; replace mobile mirror with canonical contracts. |
| Companion check-evidence script; worktree script; desktop e2e fixture helper | Delete root-index/home/root-gallery support and fixtures once Results/Assets is sole format. |

## Historical Review/Project vocabulary: delete

| Location | Behavior and deletion |
|---|---|
| review-set canvas and review-store legacy-scene test | Split behavior: accepting scene canvas is delete; dropping malformed bounded optional external content under declared policy is resilience. Do not coerce scene to HTML. |
| feature, feature-view, featureReading, feature review/events/CLI noun across CLI, daemon Review modules/routers, Web Git UI, mobile review hooks/procedures and contracts | Delete aliases in one atomic canonical Review wire/storage/CLI/UI cutover. No Feature domain remains. |
| repo, repository, repoPath, openRepoPath, repos.ts at product boundaries | Delete at canonical Projects cutover, except low-level Git usage where repository correctly means Git. |
| Settings/Companion facades owning Review/Files/Git/Project Data/Remote | Temporary scaffolding while behavior moves; then delete facades and do not create a Companion domain. |
| apps/mobile/src/components/surface-chrome.tsx | Temporary scaffolding compatibility re-export; delete after importer move. |
| Desktop extensionsCompatSession proxy | Temporary scaffolding for Electron devtools installer; upgrade/replace then delete after proof. |
| scripts/release-check.mjs | Delete unused explicitly deprecated old release gate after reference check. |
| daemon cli-install stale chunks and build-daemon-dist desktop dependency fallback | Temporary scaffolding; remove after distribution/dependency contract is singular. |

## Permanent resilience: retain, rename if “fallback” obscures owner

- Remote endpoint ordering/walk, preferred-endpoint recovery, LAN/Tailnet/Funnel availability and
  unauthorized/unreachable state in mobile provider/environments-store, endpoint contracts and
  tailnet-listener: Remote resilience, not old-client compatibility.
- Watcher failure/absence, caps/debounce, polling/focus, reconnect/re-registration/sequence-gap:
  Files/Review/Terminal resilience under Decision 009.
- Bounded symbol slicing and plain-text/highlight degradation: Viewer resilience.
- Clipboard/touch input/platform terminal protocol alternatives: platform resilience.
- Safe malformed-navigation/document-selection/error-message disposition: product default/resilience.
- Auth/path/CSP fail-closed behavior, corruption handling, resource limits, native error
  normalization and terminal detach/reattach: retain under the owners above.
- Mobile corrupt environment status and preserved corrupt blob: Remote/Project Data resilience after
  a strict v1 schema; do not add a migration framework.

## Product defaults: retain only when target schema owns them

Empty Review/Board/Actions/Notes/Scope and unpaired environment; current Review default values,
canvas height, document ordering/labels, viewer selection/preference; checks-only Evidence packs;
current Results/Assets creation; and Action is untrusted until this machine’s human accepts it.
Defaults cannot fill a field absent from a superseded representation.

## Current gates

| Gate | Coverage |
|---|---|
| pnpm lint | Biome; mobile NativeWind/type-rung and 450-line shrink-only guard; escape bans; audit URL/Git/hook checks; dispatch-only EAS; router-name to procedure catalog/refined keys; skill command citations; docs index/stale paths; versions; foundation adapters. |
| Husky pre-commit and git-guard | Branch/worktree policy and cheap lint; hook Git-env scrub. |
| Husky commit-msg | Conventional format, 72-char subject and 1024-char EAS cap. |
| pnpm verify | lint + tests + build + desktop E2E typecheck. |
| CI | Clean-room verify on PR/push; browser E2E on main/manual. |
| agents:check / agents:doctor | Claude adapters/hooks and Husky/tool wiring. |

## Material enforcement gaps against decisions 005–015

1. No machine-readable ten-domain registry, migration status, exact legacy baseline or
   specification-bound exception ledger.
2. Procedure lint proves names only; it lacks exhaustive input/output/error schemas, runtime output
   parsing, notification/stream contracts and client query mapping.
3. No daemon handshake protocol version/update-required mismatch proof.
4. No strict v1 persisted-root owner/version/corruption/reset gate.
5. No package/domain import graph for app/client-runtime/daemon separation, deep-import/cycle,
   router-to-adapter, operation-to-tRPC/adapter/operation or domain-rule I/O.
6. No target path/naming/public-entrypoint/export-map gate.
7. 450-line policy is mobile-only, not all authored production packages.
8. No public-error envelope/code-detail or message-string/native-error leakage enforcement.
9. No temporary dual-path/legacy-name completion guard.
10. Foundation sync does not assert Ship/Audit removal, one root loop, Companion nonmandatory
    lifecycle or relocated-invariant indexing.
11. CLI no-network/no-run and channel ownership are mostly prose/tests.
12. No Decision-011 operation fake/in-memory harness, contract-valid cross-client mock harness,
    named critical-E2E inventory or test-convention lint.

## Dependency order

1. Record current gates/test lanes; create domain/alias/status/exception registry and documentation
   homes. Do not remove skills.
2. Establish v1 persistence/reset plan, protocol version, public errors and notification/stream
   contract catalog.
3. Establish composition root, operation factory/capability entry points and operation/adapter test
   harness with one simple read exemplar.
4. Establish client-runtime query/mutation/event semantics, app adapters, session subscription
   manager and reconnect flow with mutation plus realtime exemplars.
5. Establish target Project Data v1 roots/clean seed; separately authorize human-data export/reset;
   then delete home and flat migrations atomically.
6. Cut Review atomically: vocabulary, active layout, Results/Assets contract/UI, then root index,
   scene, feature aliases, deprecated fields/local mirrors and worktree legacy readers.
7. Cut Projects, Files, Git, Search, Board, Actions, Terminal and Remote one at a time:
   contract → operation → capability/adapter → client-runtime → Web/mobile/CLI → tests → old path.
8. Ratchet target gates per migrated domain; shrink baselines; delete transitional allowlists only
   after all ten comply.
9. Relocate Ship/Audit knowledge, rewrite Companion lifecycle, update foundation sync/docs; then
   remove Ship/Audit and adapters in one verified commit.
10. Final proof: empty v1 seed, protocol match/mismatch, no legacy runtime references, full gate and
    critical E2E, fresh-agent root-loop discovery, explicit authorization before real-data reset.

## Completion searches

    rg -n 'ensureProjectCompanion|migrateActiveReviewLayout|migrated-from-home|loopEvidenceRoot'
    rg -n 'legacy root index|hasReport|readLegacyReport|reviewSetsPath|trustMigratedCommands'
    rg -n '\bfeature(?:-view|Reading)?\b|\brepoPath\b|openRepoPath'
    rg -n '\.agents/skills/(ship|audit)|docs/internals/audit|review clear.*session'
    pnpm lint && pnpm verify && pnpm agents:check

The first three searches are temporary inventory proofs, not replacements for the structural gates.


