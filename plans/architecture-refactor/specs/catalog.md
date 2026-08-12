# Specification catalog

This is the ordered work breakdown. A row becomes delegable only when its full recipe file satisfies
the [executor contract](README.md); the catalog alone is never implementation authorization.

Status meanings: **Landed** is current truth; **Draft** needs recipe review; **Queued** is reviewed
ahead and dependency-gated; **Ready** is reviewed for immediate execution; and **Blocked** awaits
an external choice or authorization.

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
| `CON-009` | Landed | Actions schemas remove 6 entries from the contract ledger |
| `CON-010` | Landed | Terminal request/response schemas remove 2 entries from the ledger |
| `CON-011` | Landed | Project Data schemas remove the final 6 ledger entries |
| `ERR-001` | Landed | Strict public-error contracts and exhaustive per-procedure error declarations |
| `ERR-002` | Landed | tRPC request correlation, public-error mapping, and safe unexpected diagnostics |
| `ERR-003` | Landed | Public errors at daemon HTTP authentication and pairing boundaries |
| `CON-012` | Landed | Compose the canonical catalog and add a router-validation migration gate |
| `CON-013` | Landed | Remote daemon/network routers adopt exact contract input/output middleware |
| `CON-014` | Landed | Projects and repository Files procedures adopt exact contracts |
| `CON-015` | Landed | Remaining Files and Search router procedures adopt exact contracts |
| `CON-016` | Landed | Git router procedures and Review inbox adopt exact contracts |
| `CON-017` | Landed | Review router procedures and Git diff reading adopt exact contracts |
| `CON-018` | Landed | Board router procedures adopt exact contracts |
| `CON-019` | Landed | Settings-owned cross-domain procedures adopt exact contracts |
| `CON-020` | Landed | Actions and Terminal router procedures adopt exact contracts |
| `CON-021` | Landed | Delete horizontal contracts and make catalog exhaustiveness permanent |
| `PRO-001` | Landed | Protocol-v1 contract and daemon-info field without request enforcement |
| `PRO-002` | Landed | Repository-owned HTTP/pairing adapters send the shared version header |
| `PRO-003` | Landed | Strict session hello/ready/mismatch contract and pure decision |
| `PRO-004` | Landed | Daemon enforces the version header after owned callers send it |
| `RT-001` | Landed | Typed notification, watch, session, and stateful-stream contracts |
| `RT-002` | Landed | Daemon publisher, target gateway, and bounded watch management |
| `RT-003` | Landed | Shared client recovery and declarative Files-interest runtime |
| `RT-004` | Landed | Web binds to target realtime runtime while mobile legacy remains bounded |
| `RT-005` | Landed | Mobile binds and deletes the entire legacy realtime path |
| `TST-001` | Landed | Contract fixture builders and transport-independent validating daemon mock |
| `DAE-001` | Landed | Explicit capability construction and bound-operation router context |
| `TST-002` | Landed | Operation fake conventions and controlled adapter integration fixtures |
| `DAT-001` | Landed | Strict version-1 persisted-envelope and atomic/corruption adapter conventions |
| `CLI-001` | Landed | CLI build/dependency/channel boundary gate before command cutovers |

## Batch 1 — Board primary exemplar

| ID | Status | Outcome |
| --- | --- | --- |
| `BRD-001` | Landed | Canonical exhaustive Board procedures, errors, notification, and fixtures |
| `BRD-002` | Landed | Board rules, operations, v1 store adapter, composition, router, and tests |
| `BRD-003` | Landed | Board client-runtime query identities, mutation consequences, and notification mapping |
| `BRD-004` | Landed | Web Board feature adapter/presentation uses contracts and shared semantics |
| `BRD-005` | Landed | Mobile Board deletes Review-local descriptors and completes the domain gate |

## Batch 2 — focused behavior exemplars

| ID | Status | Outcome |
| --- | --- | --- |
| `RVC-001` | Landed | Review comment contracts and add/edit/delete/resolve/clear operations |
| `RVC-002` | Landed | Shared optimistic transitions, rollback, reconciliation, and notification consequences |
| `RVC-003` | Landed | Web comments adopt shared optimism and contract mock |
| `RVC-004` | Landed | Mobile comments adopt the same semantics and delete local descriptors |
| `FIL-001` | Landed | Canonical file read/write/tree/pin/scope contracts and expected failures |
| `FIL-002` | Landed | Safe-path/read-limit Files capabilities, operations, and filesystem adapter proof |
| `FIL-003` | Landed | Declarative bounded watches and typed successful-change facts |
| `FIL-004` | Landed | Shared Files query/mutation/watch/recovery semantics |
| `FIL-005` | Landed | Web Files adapter and Viewer seam remove raw daemon models |
| `FIL-006` | Landed | Mobile Files adapter deletes local schemas and string invalidations |
| `GIT-001` | Landed | Checkout/add-worktree/status/branches/worktrees contracts and failures |
| `GIT-002` | Landed | Checkout and add-worktree operations over hardened Git capabilities |
| `GIT-003` | Landed | Distinct non-optimistic checkout/add-worktree query consequences |
| `GIT-004` | Landed | Both clients adopt shared worktree mutation semantics |
| `TRM-001` | Landed | Terminal stream command/event/epoch/sequence/error vocabulary |
| `TRM-002` | Landed | PTY capability, lifecycle operations, environment policy, and stream gateway |
| `TRM-003` | Landed | Transport-neutral attach/correlation/recovery/scrollback state machine |
| `TRM-004` | Landed | Web socket/Ghostty adapter adopts shared stream semantics |
| `TRM-005` | Landed | Mobile native adapter adopts shared stream semantics |

## Batch 3 — remaining domain cutovers

| ID | Status | Outcome |
| --- | --- | --- |
| `PRJ-001` | Landed | Canonical Project contracts and open/recent/remove/discovery operations |
| `PRJ-002` | Landed | Shared Project identities/effects and Web/mobile selection adapters |
| `PRJ-003` | Landed | Delete product-boundary repo/workspace aliases and complete domain |
| `SEA-001` | Landed | Search contracts and file/text/code operations over Files/Git capabilities |
| `SEA-002` | Landed | Shared Search keys/effects and Web/mobile feature relocation |
| `SEA-003` | Draft | Delete Files/Git router and mobile Files ownership; complete domain |
| `GIT-005` | Landed | Remaining Git mutation/read operations, domain rules, and adapter seams |
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
| `PDT-004` | Draft | Recorded reset authorization, classification fixtures, and manual-only procedure |
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
| `LCH-001` | Draft | Clean-v1 seed/reset and protocol match/mismatch launch rehearsal |
| `LCH-002` | Draft | Remove final ledgers and prove canonical/fresh-agent discoverability |
| `LCH-003` | Draft | Clean-checkout verify and named browser/Terminal/packaging evidence |

There are 110 bounded units. Broad rows split if factual recipe authoring shows overlapping files or
more than one reviewable commit; they never remain broad by asking an executor to make that split.
