# Data and workflow inventory

**Status:** factual inventory evidence for the architecture-refactor decision program. This records
current persistence, CLI, cross-domain behavior and clean-cutover classifications assessed on
2026-08-09. It is not implementation authorization or a migration specification.

**Scope:** daemon-home/user-data/project-companion persistence, the agent CLI, and workflows that
cross the canonical domains established by Decisions 003, 004, 006, 009, 013 and 015.

## Persisted roots and records

| Physical path / glob | Current readers/writers | Owner | Current format and disposition |
| --- | --- | --- | --- |
| `<userData>/config.json` | `stores/config-store.ts`, `repo-config.ts`, `router/repos.ts`, `router/network.ts`, `server.ts` | `ambiguous` (Projects + Remote) | App-sole-writer memory-cached JSON. It mixes recents and listener flags; target needs explicit owner(s) and version-1 strict format. |
| `~/.porcelain/access.json` or `PORCELAIN_ACCESS_FILE` | `stores/access-store.ts` | `remote` | Version 1 pairing/client secret hashes; atomic mode-0600 write and corrupt-file recovery are retained security/resilience. |
| `~/.porcelain/admin-token` | `net/admin-token.ts` | `remote` | Local credential, not historical companion data. |
| `~/.porcelain/action-trust.json` or `PORCELAIN_ACTION_TRUST_FILE` | `stores/action-trust-store.ts` | `actions` | Machine-local command fingerprints keyed by absolute Project path; needs target strict/versioned ownership. |
| `~/.porcelain/<CLI bundle>` | `cli-install.ts` | `support:CLI delivery` | Operational installed agent executable, not product-domain state. |
| `~/.porcelain/actions.json`, `board.json`, `layers.json`, `scope.json`, `notes.json`, `comments.json`, `reviewed.json`, `review-sets.json`, `feature-view.json` | `project/migrate-home.ts` | `legacy/delete` | Historical home records keyed by Project; currently copied/purged. Target must neither read nor discover them. |
| `~/.porcelain/loop-evidence/<hash>` | `project/migrate-home.ts` | `legacy/delete` | Historical evidence directory copied to Project data. |
| `<repo>/.porcelain/.gitignore` | `net/project-channel.ts`, `project/companion-disposition.ts`, `project/git-exclude.ts` | `project-data` | Managed sharing/disposition policy; the target record/policy has one Project Data owner. |
| `<repo>/.porcelain/actions.json` | `stores/actions-store.ts`, CLI `action-file.ts` | `actions` | Two-way app/CLI array; default shared disposition. |
| `<repo>/.porcelain/board.json` | `stores/board-store.ts`, CLI `board-file.ts` | `board` | Two-way app/CLI array. |
| `<repo>/.porcelain/scope.json` | `stores/scope-store.ts`, CLI `scope-file.ts` | `files` | Repo-relative hide/pin paths. |
| `<repo>/.porcelain/layers.json` | `stores/layers-store.ts`, CLI `layers-file.ts` | `review` | Review reading-flow grouping; absent document selects defaults. |
| `<repo>/.porcelain/notes.md` | `stores/notes-store.ts`, CLI `notes-file.ts` | `project-data` | App-written markdown. |
| `<repo>/.porcelain/feature-view.json` | `stores/feature-snapshot-store.ts`, CLI `feature-view-file.ts` | `review` / derived | Always-ignored app-to-agent snapshot, not authoritative authored Review data. |
| `<repo>/.porcelain/active-review/review.json` | `stores/review-store.ts`, CLI `review-file.ts` | `review` | Active Review document. |
| `<repo>/.porcelain/active-review/comments.json` | `stores/comment-store.ts`, CLI `comment-file.ts` | `review` | Active reviewer comments. |
| `<repo>/.porcelain/active-review/reviewed.json` | `stores/reviewed-store.ts`, CLI `reviewed-file.ts` | `review` | Content-fingerprinted reviewed marks. |
| `<repo>/.porcelain/active-review/intent/{meta.json,assets/*,*.(md|markdown|html)}` | CLI `intent-file.ts`; daemon `review/doc-set.ts` | `review` | Intent document set; CLI and daemon duplicate its format logic. |
| `<repo>/.porcelain/active-review/evidence/{meta.json,index.html,results/*,assets/*}` | CLI `evidence-file.ts`; daemon `stores/evidence-store.ts`, `review/doc-set.ts`, `review/evidence-assets-list.ts` | `review` | Evidence pack. Bounds/sandbox/corruption handling remain; legacy report/HTML representations do not. |
| `<repo>/.porcelain/reviews/<id>/{meta.json,review.json,comments.json,reviewed.json,intent/**,evidence/**}` | `stores/review-store.ts` | `review` | Archived Review copy. Publishing force-stages Git and changes companion disposition. |
| `<repo>/.porcelain/{review.json,comments.json,reviewed.json,intent/**,evidence/**}` | `project/migrate-active-review.ts` | `legacy/delete` | Flat active-Review layout. |
| `<repo>/.porcelain/.migrated-from-home`, `*.tmp`, `*.corrupt-*` | project channels/migrators | migration/support recovery | Marker is migration-only. Tmp/corrupt artifacts implement durable-write recovery and remain meaningful under strict target formats. |
| Terminal attachment scratch paths | `terminal/image-paste.ts` | `terminal` | Daemon-local transient attachment state; target spec must declare root and cleanup. |
| In-memory terminal sessions/scrollback | `terminal/terminal-manager.ts`, `scrollback-buffer.ts` | `terminal` | Not persisted; recoverable while daemon lives via attachment/scrollback. |
| In-memory working-tree cache | `git/working-tree.ts` | `git` | Derived cache, directly cleared by router mutations. |
| In-memory Review reading cache | `review/feature-build.ts` | `review` | Derived cache with implicit/partial invalidation. |

### Current persistence engines and policy leaks

| Exact path | Current responsibility | Boundary finding |
| --- | --- | --- |
| `apps/daemon/src/net/home-channel.ts` | Atomic JSON, validation, corrupt backup, serialized mutation for home/user-data documents | Supporting persistence driver; it should not imply one product owner. |
| `apps/daemon/src/net/project-channel.ts` | Atomic project JSON channel | Also calls Project Data migration, Git-exclude policy and Review watcher registration on reads/writes: infrastructure currently owns product side effects. |
| `apps/daemon/src/project/migrate-home.ts` | Home-to-project copy/purge | A read via every companion store can execute pre-launch migration and write files. Delete after clean reset/cutover. |
| `apps/daemon/src/project/migrate-active-review.ts` | Flat active slots to `active-review/` | One-way layout compatibility; delete after cutover. |
| `apps/daemon/src/project/companion-disposition.ts` and `project/git-exclude.ts` | Git visibility/share policy | Project Data behavior presently called by stores and Review publishing. |

## Agent CLI — exhaustive noun/verb map

`apps/cli/src/cli.ts` is a dependency-light direct filesystem companion channel, not a daemon RPC
client. It resolves a Project then uses its own synchronous read/modify/write helpers under
`apps/cli/src/*.ts`, duplicating several daemon persistence schemas.

| Owner | Noun | Verbs | Current helper(s) |
| --- | --- | --- | --- |
| `review` | `review` | `set`, `add`, `get`, `clear`, `set-canvas`, `clear-canvas` | `review-file.ts` |
| `review` | `feature` | `get` | `feature-view-file.ts` (derived snapshot) |
| `review` | `comments` | `list`, `resolve`, `answer` | `comment-file.ts` |
| `review` | `reviewed` | `list` | `reviewed-file.ts` |
| `review` | `intent` | `prepare`, `order`, `list` | `intent-file.ts`, `doc-set-file.ts` |
| `review` | `evidence` | `prepare`, `set`, `check`, `results-order`, `results-list`, `assets-list`, `get`, `clear` | `evidence-file.ts`, `doc-set-file.ts`, `html-input.ts` |
| `review` | `layers` | `get`, `set`, `reset` | `layers-file.ts` |
| `board` | `board` | `list`, `create`, `update`, `move`, `delete` | `board-file.ts` |
| `actions` | `actions` | `list`, `create`, `update`, `delete` | `action-file.ts` |
| `project-data` | `notes` | `get` | `notes-file.ts` |
| `files` | `scope` | `list`, `hide`, `unhide`, `pin`, `unpin`, `clear` | `scope-file.ts` |

There are 11 nouns and 41 noun-verbs. There are no CLI nouns for Projects, Git, Search, Terminal or
Remote. That can remain an intentional agent-channel boundary, but direct writers must converge on
the owning versioned document schema/capability; a parallel best-effort format cannot survive a
completed Decision 015 cutover.

## Cross-domain workflow map

| Current workflow | Exact path(s) | Top-level owner | Current collaborators and hidden behavior |
| --- | --- | --- | --- |
| Open a Project | `router/repos.ts:openRepoPath` | `projects` | Project existence → recent-project persistence → Project Data home migration → Review companion watcher → Git file-list warmup. Entire sequence is handler-local. |
| Commit/discard/stage Git changes | `router/git.ts:gitCommit`, `gitDiscardFile`, stage mutations | `git` | Git capability → Git cache; commit clears Review marks. Router directly mutates foreign Review persistence. |
| Review Inbox | `router/git.ts:worktreeInbox` → `git/worktree-inbox.ts` | `review` | Review intention coordinates Git worktree query. Source location is misleading. |
| Diff reading | `router/review.ts:diffReading` → flow builders + Git reads | `git` | Changes/History reading coordinates Git flow/diffs and handler-local missing-file recovery. |
| Review reading | `router/review.ts:featureReading` | `review` | Review set + layers + Git statuses/diffs + Evidence metadata + cache. Required work is spread across router/helper chains. |
| Clear/publish/archive/restore Review | `stores/review-store.ts`, review router | `review` | Active documents/evidence/comments/marks → archive filesystem → Project Data disposition/ignore → Git force-stage. Mixed-effect order, partial failure and compensation are implicit. |
| Define/trust/run saved action | `stores/actions-store.ts`, trust store, Terminal UI/WS | `actions` (definition/trust and future run coordinator) | Current public procedures define/trust only. A human run must use a visible Terminal capability; Terminal must not own trust. |
| Search with Files scope | `router/files.ts:searchFiles` | `search` | Git tracked-file list + Files hidden paths + candidates/fuzzy search; foreign scope store is accessed directly. |
| First companion mutation/read | `net/project-channel.ts` → `migrate-home.ts` → `git-exclude.ts` → `review-watch.ts` | `project-data` owns layout/policy; caller owns record | A read may write/migrate/disposition-watch. Target read paths must not keep history conversion. |
| Agent channel notification | CLI writes → `review/review-watch.ts` → `app-events.ts` → `net/session.ts` | changed domain | File-name watcher maps to coarse broadcast events; no typed change fact or explicit recovery contract. |

These are the present workflows. Decision 004 requires each target workflow to make collaborators
and required ordering visible in one top-level operation; the table does not authorize moving or
combining code yet.

## Compatibility deletion versus resilience retention

| Current behavior | Classification | Factual reason |
| --- | --- | --- |
| Home-record conversion/purge and home evidence copy | `legacy/delete` | Supports only earlier pre-launch storage locations. |
| Flat companion active-review migration | `legacy/delete` | Supports only an earlier layout. |
| `reviewSetsPath`, `resolveScopePath`, contracts `router.ts` tombstone | `legacy/delete` | Transition aliases/stale import compatibility. |
| `AppEvent`, `Session.send(channel, ...args)` | `legacy/delete` after typed notification/stream cutover | Preserves Electron-shaped coarse session protocol. |
| Evidence `medium: 'html'`, `index.html`, `hasReport`, `reviewEvidenceDocs` historical name | `legacy/delete` | Retained for older installed clients/representations. |
| `repo`/`repoPath`/`openRepoPath` and `feature*`/`clearFeatureReview` vocabulary | canonicalization input | Pre-launch aliases to replace atomically; not target synonyms. |
| Atomic tmp+rename, corruption backup/diagnostics, size/watcher/process limits | retain resilience/security | Supported filesystem/process failures exist independently of Porcelain history. |
| Auth/token checks, URL/path/sandbox validation, Git env handling | retain resilience/security | Fail-closed external boundaries. |
| Socket reconnect, registration replay, active-query refresh, terminal reattach/scrollback | retain resilience | Actual network/session failure recovery, not protocol compatibility. |
| Empty documents/default layers/default dispositions | retain intentional defaults | Current-product behavior, to seed/test from clean target state rather than infer from legacy files. |

## Unresolved ownership requiring an explicit specification decision

| Item | Candidates | Current evidence |
| --- | --- | --- |
| `repo-config.ts` / config document | Projects + Remote | One `config.json` mixes recent Projects and LAN/Tailnet/Funnel flags. |
| Review flow/layers | Review + Git | Flow grouping belongs to Review reading but also drives Git Changes/History. |
| `feature-view.json` | Review projection + supporting derived cache | App-generated, always ignored, CLI-readable snapshot. |
| Evidence paths/assets | Review + Files capability | Review owns the intention; Files owns safe path/sandbox/resource mechanics. |
| `search/suggestions.ts` | Search + Git | Need caller/behavior classification to determine whether it is advice or search. |
| CLI installation | Remote daemon lifecycle + support:CLI delivery | Daemon refreshes a direct agent channel at startup. |
| Terminal paste storage | Terminal + possibly Project Data | Current path/lifecycle is transient but target cleanup/disposition is unrecorded. |

