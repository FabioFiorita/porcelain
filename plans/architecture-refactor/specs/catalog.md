# Specification catalog

This is the ordered work breakdown. A row becomes delegable only when its full recipe file satisfies
the [executor contract](README.md); the catalog alone is never implementation authorization.

Status meanings: **Landed** is current truth, **Draft** needs recipe review, **Ready** contains no
open judgment and has landed dependencies, and **Blocked** names a dependency or authorization.

## Batch 0 — architecture and contract foundations

| ID | Status | Outcome |
| --- | --- | --- |
| `ARC-001` | Landed | Canonical registry, target model, active AGENTS guidance, and package/debt/file-size ratchet |
| `ARC-002` | Landed | Import-graph and domain-public-entry checks become migration-status aware |
| `CON-001` | Landed | Contract-domain scaffolding, ownership baseline, and exact shrink-only 113-procedure ledger |
| `CON-002` | Landed | Remote schemas remove 12 entries from the contract ledger |
| `CON-003` | Landed | Projects schemas remove 4 entries from the contract ledger |
| `CON-004` | Landed | Files schemas remove 15 entries from the contract ledger |
| `CON-005` | Landed | Search schemas remove 3 entries from the contract ledger |
| `CON-006` | Landed | Git schemas remove 30 entries from the contract ledger |
| `CON-007` | Landed | Review schemas remove 29 entries, including the unknown reading output |
| `CON-008` | Landed | Board schemas remove 6 entries from the contract ledger |
| `CON-009` | Draft | Actions schemas remove 6 entries from the contract ledger |
| `CON-010` | Draft | Terminal request/response schemas remove 2 entries from the ledger |
| `CON-011` | Draft | Project Data schemas remove the final 6 ledger entries |
| `ERR-001` | Draft | Contract public-error envelope and centralized daemon mapping with request correlation |
| `CON-012` | Draft | Delete the horizontal fallback and enforce router input/output/kind exhaustiveness |
| `PRO-001` | Draft | Protocol-v1 contract and daemon-info field without request enforcement |
| `PRO-002` | Draft | Repository-owned HTTP/pairing adapters send the shared version header |
| `PRO-003` | Draft | Strict session hello/ready/mismatch contract and pure decision |
| `PRO-004` | Draft | Daemon enforces the version header after owned callers send it |
| `RT-001` | Draft | Typed notification, watch, session, and stateful-stream contracts |
| `RT-002` | Draft | Daemon publisher, target gateway, and bounded watch management |
| `RT-003` | Draft | Shared client recovery and declarative Files-interest runtime |
| `RT-004` | Draft | Web binds to target realtime runtime while mobile legacy remains bounded |
| `RT-005` | Draft | Mobile binds and deletes the entire legacy realtime path |
| `TST-001` | Draft | Contract fixture builders and transport-independent validating daemon mock |
| `DAE-001` | Draft | Explicit capability construction and bound-operation router context |
| `TST-002` | Draft | Operation fake conventions and controlled adapter integration fixtures |
| `DAT-001` | Draft | Strict version-1 persisted-envelope and atomic/corruption adapter conventions |
| `CLI-001` | Draft | CLI build/dependency/channel boundary gate before command cutovers |

## Batch 1 — Board primary exemplar

| ID | Status | Outcome |
| --- | --- | --- |
| `BRD-001` | Draft | Canonical exhaustive Board procedures, errors, notification, and fixtures |
| `BRD-002` | Draft | Board rules, operations, v1 store adapter, composition, router, and tests |
| `BRD-003` | Draft | Board client-runtime query identities, mutation consequences, and notification mapping |
| `BRD-004` | Draft | Web Board feature adapter/presentation uses contracts and shared semantics |
| `BRD-005` | Draft | Mobile Board deletes Review-local descriptors and completes the domain gate |

## Batch 2 — focused behavior exemplars

| ID | Status | Outcome |
| --- | --- | --- |
| `RVC-001` | Draft | Review comment contracts and add/edit/delete/resolve/clear operations |
| `RVC-002` | Draft | Shared optimistic transitions, rollback, reconciliation, and notification consequences |
| `RVC-003` | Draft | Web comments adopt shared optimism and contract mock |
| `RVC-004` | Draft | Mobile comments adopt the same semantics and delete local descriptors |
| `FIL-001` | Draft | Canonical file read/write/tree/pin/scope contracts and expected failures |
| `FIL-002` | Draft | Safe-path/read-limit Files capabilities, operations, and filesystem adapter proof |
| `FIL-003` | Draft | Declarative bounded watches and typed successful-change facts |
| `FIL-004` | Draft | Shared Files query/mutation/watch/recovery semantics |
| `FIL-005` | Draft | Web Files adapter and Viewer seam remove raw daemon models |
| `FIL-006` | Draft | Mobile Files adapter deletes local schemas and string invalidations |
| `GIT-001` | Draft | Checkout/add-worktree/status/branches/worktrees contracts and failures |
| `GIT-002` | Draft | Checkout and add-worktree operations over hardened Git capabilities |
| `GIT-003` | Draft | Distinct non-optimistic checkout/add-worktree query consequences |
| `GIT-004` | Draft | Both clients adopt shared worktree mutation semantics |
| `TRM-001` | Draft | Terminal stream command/event/epoch/sequence/error vocabulary |
| `TRM-002` | Draft | PTY capability, lifecycle operations, environment policy, and stream gateway |
| `TRM-003` | Draft | Transport-neutral attach/correlation/recovery/scrollback state machine |
| `TRM-004` | Draft | Web socket/Ghostty adapter adopts shared stream semantics |
| `TRM-005` | Draft | Mobile native adapter adopts shared stream semantics |

## Batch 3 — remaining domain cutovers

| ID | Status | Outcome |
| --- | --- | --- |
| `PRJ-001` | Draft | Canonical Project contracts and open/recent/remove/discovery operations |
| `PRJ-002` | Draft | Shared Project identities/effects and Web/mobile selection adapters |
| `PRJ-003` | Draft | Delete product-boundary repo/workspace aliases and complete domain |
| `SEA-001` | Draft | Search contracts and file/text/code operations over Files/Git capabilities |
| `SEA-002` | Draft | Shared Search keys/effects and Web/mobile feature relocation |
| `SEA-003` | Draft | Delete Files/Git router and mobile Files ownership; complete domain |
| `GIT-005` | Draft | Remaining Git mutation/read operations, domain rules, and adapter seams |
| `GIT-006` | Draft | Changes/diff/history/commit/branch client-runtime and app cutover |
| `GIT-007` | Draft | Remove Review/settings router leakage and complete Git domain |
| `ACT-001` | Draft | Actions contracts, trust, CRUD/run-preparation operations, and v1 adapters |
| `ACT-002` | Draft | Shared Actions query/mutation/notification semantics and run preparation |
| `ACT-003` | Draft | Relocate UI and execute through explicit Actions → Terminal workflow |
| `ACT-004` | Draft | Delete Terminal-owned descriptors/facades and complete Actions |
| `TRM-006` | Draft | Remaining Terminal request/response cutover and completed stream gate |
| `REM-001` | Draft | Remote endpoint/identity/pairing/access contracts and public failures |
| `REM-002` | Draft | Auth, pairing, CORS, listener, Funnel/LAN/Tailnet operations/adapters |
| `REM-003` | Draft | Shared endpoint selection, retry, session health, and public-error parsing |
| `REM-004` | Draft | Web local/remote/shell adapter and settings presentation cutover |
| `REM-005` | Draft | Mobile strict-v1 environment and provider; delete version-3/icon coercion |
| `REM-006` | Draft | Remote security/resilience proof and completed domain gate |

## Batch 4 — Project Data and complete Review

| ID | Status | Outcome |
| --- | --- | --- |
| `PDT-001` | Draft | Version-1 root manifest and per-domain persisted-file ownership |
| `PDT-002` | Draft | Notes, dispositions, layers, visibility contracts/operations/adapters |
| `PDT-003` | Draft | Web/mobile settings adapters over Project Data semantics |
| `PDT-004` | Blocked | Exact export/backup/reset of disposable and human-authored pre-launch data |
| `PDT-005` | Draft | Delete home and active-layout migrations after authorized clean-state path |
| `PDT-006` | Draft | Corruption/atomicity/ownership proof and completed domain gate |
| `REV-001` | Draft | Canonical active/archive/reading/intent/reviewed/inbox contracts |
| `REV-002` | Draft | Active Review/archive operations, rules, stores, and composition |
| `REV-003` | Draft | Reading/explore/inbox operations over narrow Git/Files capabilities |
| `REV-004` | Draft | Results/Assets-only Evidence contracts, containment, caps, and store |
| `REV-005` | Draft | Canonical Review CLI nouns and version-1 document writers |
| `REV-006` | Draft | Shared Review query/mutation/notification semantics beyond comments |
| `REV-007` | Draft | Web Review feature relocation and daemon-type removal |
| `REV-008` | Draft | Mobile Review feature and local schema deletion |
| `REV-009` | Draft | Delete Feature names, scene/root-index Evidence, deprecated readers/tests |
| `REV-010` | Draft | Active-content/CSP/containment/resilience proof and completed domain gate |

## Batch 5 — supporting regions, foundations, and launch

| ID | Status | Outcome |
| --- | --- | --- |
| `SUP-001` | Draft | Remove product ownership from global Web/mobile shell/settings regions |
| `SUP-002` | Draft | Preserve Viewer virtualization/large-input/plain-text behavior |
| `SUP-003` | Draft | Prove thin Desktop, one daemon, safe URLs, and packaging boundaries |
| `E2E-001` | Draft | Name/reduce critical assembled wiring suite and relocate redundant tests |
| `AGT-001` | Draft | Relocate every Ship responsibility and Audit invariant to current owners |
| `AGT-002` | Draft | Remove mandatory Companion Review lifecycle and migration guidance |
| `AGT-003` | Draft | Delete Ship/Audit and audit docs; strengthen foundation sync |
| `LCH-001` | Blocked | Clean-v1 seed/reset and protocol match/mismatch launch rehearsal |
| `LCH-002` | Draft | Remove final ledgers and prove canonical/fresh-agent discoverability |
| `LCH-003` | Draft | Clean-checkout verify and named browser/Terminal/packaging evidence |

There are 99 bounded units. Broad rows split if factual recipe authoring shows overlapping files or
more than one reviewable commit; they never remain broad by asking an executor to make that split.
