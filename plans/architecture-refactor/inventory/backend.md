# Backend inventory

**Status:** factual inventory evidence for the architecture-refactor decision program. This records
the current daemon and contracts shape assessed on 2026-08-09; it is not a migration specification
or target-state documentation.

**Scope:** `apps/daemon` and `packages/contracts`, assessed against accepted Decisions 001–015.
Canonical product keys are `projects`, `files`, `git`, `search`, `review`, `board`, `actions`,
`terminal`, `project-data`, and `remote`. `support:<name>` denotes a named supporting region rather
than an additional product domain; `legacy/delete` denotes pre-launch history to remove under a
Decision 015 cutover; `ambiguous` requires an explicit specification-level owner.

## Counts and topology

| Surface | Count | Current fact |
| --- | ---: | --- |
| Public tRPC procedures | 113 | Flat names from nine routers, merged in `apps/daemon/src/api.ts`; every handler is router-owned today. |
| Router source modules | 9 | `repos`, `files`, `git`, `review`, `settings`, and `terminal` contain more than one target domain. |
| Contract procedure names | 113 | `packages/contracts/src/procedures/names.ts` matches the router surface mechanically. |
| Refined procedure I/O entries | 63 | `featureReading` has `z.unknown()` output; 50 other catalog entries fall back to unknown input/output. |
| WS application-event discriminators | 8 | Coarse `AppEvent` mixes global change signals with targeted watch refresh. |

The preserved runtime path is daemon tRPC/HTTP plus authenticated `/session` WebSocket. There is no
current application-operation layer or daemon composition root: routers import stores, host adapters
and other domain modules directly.

## Exhaustive public procedure map

`Q` means query, `M` means mutation, and `admin` means `adminProcedure`. All names are public
tRPC procedure names, not proposed replacements.

| Owner | Current router | Procedures | Current finding |
| --- | --- | --- | --- |
| `remote` | `apps/daemon/src/router/daemon.ts` | `daemonInfo Q`; `accessStatus Q admin`; `issuePairingLink M admin`; `revokePairingLink M admin`; `revokeAuthorizedClient M admin`; `revokeCurrentClient M` | Identity/version, pairing, access persistence and session revocation are called directly; pairing URL policy and expected errors are handler-local. |
| `remote` | `apps/daemon/src/router/network.ts` | `tailnetStatus Q admin`; `setTailnetBind M admin`; `lanStatus Q admin`; `setLanBind M admin`; `funnelStatus Q admin`; `setFunnelBind M admin` | Router reads ambient environment, persists flags and starts/stops listeners. |
| `projects` | `apps/daemon/src/router/repos.ts` | `openRepoPath M`; `recentRepos Q`; `removeRecentRepo M`; `browseDirs Q` | Opening coordinates stat, recents, home migration, watcher registration and Git warmup in one handler. |
| `files` | `apps/daemon/src/router/repos.ts` | `readDir Q`; `hidePath M`; `unhidePath M`; `pinPath M`; `unpinPath M`; `pinnedEntries Q` | File navigation/scope is misplaced in `repos`; `readDir` directly uses Node filesystem calls. |
| `files` | `apps/daemon/src/router/files.ts` | `readFile Q`; `previewHtml Q`; `writeTextFile M`; `createFile M`; `createFolder M`; `renamePath M`; `duplicatePath M`; `trashPath M` | Direct `node:fs`/trash calls and native error inspection occur in handlers. |
| `search` | `apps/daemon/src/router/files.ts` | `searchText Q`; `searchCode Q`; `searchFiles Q` | Search is mixed into Files and directly combines Git grep/listing, Files scope and fuzzy search. |
| `git` | `apps/daemon/src/router/git.ts` | `gitQuickCommand M`; `gitPush M`; `gitStageAll M`; `gitUnstageAll M`; `gitStageFile M`; `gitUnstageFile M`; `gitDiscardFile M`; `gitCommit M`; `gitGenerateCommitMessage M`; `gitGenerateCommitGroups M`; `gitCommitConventions Q`; `gitStatus Q`; `gitSuggestions Q`; `gitFlow Q`; `gitRangeFlow Q`; `gitRangeDiffFile Q`; `gitDiffFile Q`; `gitHead Q`; `gitBranches Q`; `gitCheckout M`; `gitCreateBranch M`; `gitWorktrees Q`; `gitAddWorktree M`; `gitLog Q`; `gitCommitMessage Q`; `gitFileLog Q`; `gitCommitDiff Q`; `gitCommitFlow Q` | 28 Git procedures; mutations directly clear Git caches and/or Review marks. |
| `git` | `apps/daemon/src/router/review.ts` | `diffReading Q` | Changes/History is Git-owned under Decision 013, but the review router builds it from Review flow helpers and Git diffs. |
| `git` | `apps/daemon/src/router/settings.ts` | `commitModels Q` | Git product behavior under a Settings transport location. |
| `review` | `apps/daemon/src/router/git.ts` | `worktreeInbox Q` | Review Inbox intention currently lives in a Git router/module. |
| `review` | `apps/daemon/src/router/review.ts` | `markReviewed M`; `unmarkReviewed M`; `reviewedPaths Q`; `setReviewed M`; `featureView Q`; `featureReading Q`; `clearFeatureReview M`; `reviewIntent Q`; `reviewEvidenceDocs Q`; `reviewEvidenceAssets Q`; `reviewEvidenceAsset Q`; `reviewPublishCost Q`; `publishReview M`; `archivedReviews Q`; `restoreArchivedReview M`; `deleteArchivedReview M`; `loopEvidence Q`; `loopEvidenceHtml Q`; `clearLoopEvidence M`; `reviewComments Q`; `addReviewComment M`; `editReviewComment M`; `deleteReviewComment M`; `clearResolvedReviewComments M`; `resolveReviewComment M`; `exploreFeature Q` | 26 procedures; historical `feature` vocabulary is a Review alias. |
| `review` | `apps/daemon/src/router/settings.ts` | `repoLayers Q`; `setRepoLayers M` | Reading-flow layers are Review behavior, not Settings ownership. |
| `files` | `apps/daemon/src/router/settings.ts` | `repoScope Q` | Read-side scope; its mutations remain in `repos.ts`. |
| `board` | `apps/daemon/src/router/board.ts` | `boardCards Q`; `addBoardCard M`; `updateBoardCard M`; `moveBoardCard M`; `deleteBoardCard M`; `clearBoardCards M` | Simple direct-store CRUD; no operation seam. |
| `actions` | `apps/daemon/src/router/terminal.ts` | `actions Q`; `trustActions M`; `addAction M`; `updateAction M`; `moveAction M`; `deleteAction M` | Saved commands and machine-local trust belong to Actions, not Terminal. |
| `terminal` | `apps/daemon/src/router/terminal.ts` | `terminalSessions Q`; `renameTerminal M` | Request/response terminal management; create/attach/write streams use WS. |
| `project-data` | `apps/daemon/src/router/settings.ts` | `repoNotes Q`; `setRepoNotes M`; `companionDispositions Q`; `companionGitVisibility Q`; `setCompanionGitVisibility M`; `setCompanionDisposition M` | Companion layout/visibility policy is aggregated under Settings. |

### Router extraction pressure

| Router | Lines | Current domains | Evidence |
| --- | ---: | --- | --- |
| `router/review.ts` | 412 | Review 26 + Git 1 | Thickest router: direct Node file reads, Git facade, builders, five stores and recovery catches. |
| `router/git.ts` | 218 | Git 28 + Review 1 | Direct Git facade/trash/cache plus Review store and Review flow imports. |
| `router/repos.ts` | 162 | Projects 4 + Files 6 | Direct Node, Git, config, scope, migration and watcher coordination. |
| `router/files.ts` | 162 | Files 8 + Search 3 | Direct filesystem adapters, Git search and Files scope store. |
| `router/network.ts` | 139 | Remote 6 | Listener lifecycle and config persistence in transport handler. |
| `router/settings.ts` | 110 | Git 1 + Review 2 + Files 1 + Project Data 6 | Supporting Settings region presently owns domain behavior. |
| `router/terminal.ts` | 90 | Actions 6 + Terminal 2 | Product split is required. |
| `router/daemon.ts` | 70 | Remote 6 | Pairing and authorization behavior is handler-local. |
| `router/board.ts` | 60 | Board 6 | Small direct-store router; a simple operation candidate. |

## Contract inventory

| Exact path | Current contents | Classification |
| --- | --- | --- |
| `packages/contracts/src/procedures/names.ts` | `PROCEDURE_NAMES`, `ProcedureName`, name set for all 113 flat names | Exhaustive name catalog, but no domain composition or canonical vocabulary. |
| `packages/contracts/src/procedures/io.ts` | `procedureIo: Record<ProcedureName, ProcedureIo>` | Mechanically exhaustive only: missing refined entries become `{ input: z.unknown(), output: z.unknown() }`. |
| `packages/contracts/src/procedures/refined.ts` | 63 entries and leaf schemas | Horizontal mixed-domain catalog; `featureReading` is explicitly unknown output. |
| `packages/contracts/src/procedures/index.ts`, `index.ts` | Catalog/package barrels | `support:contracts`; target domain modules should compose these surfaces. |
| `packages/contracts/src/ws-protocol.ts` | `AppEvent`, ClientMessage, ServerMessage, terminal limits/prompt helpers | Mixed Files/Review/Board/Actions/Terminal/session protocol. |
| `packages/contracts/src/commit-model.ts` | Commit models and generation schemas | `git`. |
| `packages/contracts/src/environment.ts` | Endpoint kind/order | `remote` pure wire/product helper. |
| `packages/contracts/src/head.ts` | `HeadRef`, `headLabel` | `git`; the crossed-wire interface is handwritten rather than Zod-derived. |
| `packages/contracts/src/router.ts` | `type AppRouter = never` stale-import tombstone | `legacy/delete` once callers have moved. |

### Refined I/O coverage (all 63 entries)

| Owner | Names |
| --- | --- |
| `remote` | `daemonInfo`, `revokeCurrentClient` |
| `projects` | `recentRepos`, `openRepoPath`, `browseDirs`, `removeRecentRepo` |
| `files` | `readDir`, `pinnedEntries`, `readFile`, `hidePath`, `unhidePath`, `pinPath`, `unpinPath` |
| `search` | `searchFiles` |
| `git` | `gitFlow`, `gitHead`, `gitLog`, `gitCommitMessage`, `gitCommitFlow`, `commitModels`, `gitDiffFile`, `gitCommitDiff`, `diffReading`, `gitCommitConventions`, `gitGenerateCommitMessage`, `gitGenerateCommitGroups`, `gitSuggestions`, `gitStageAll`, `gitUnstageAll`, `gitStageFile`, `gitUnstageFile`, `gitDiscardFile`, `gitCommit`, `gitPush`, `gitQuickCommand`, `gitBranches`, `gitWorktrees`, `gitCheckout` |
| `review` | `reviewedPaths`, `markReviewed`, `unmarkReviewed`, `setReviewed`, `featureView`, `featureReading` (unknown output), `loopEvidence`, `loopEvidenceHtml`, `reviewIntent`, `reviewEvidenceDocs`, `reviewEvidenceAssets`, `reviewEvidenceAsset`, `reviewComments`, `addReviewComment`, `editReviewComment`, `deleteReviewComment` |
| `board` | `boardCards`, `addBoardCard`, `updateBoardCard`, `moveBoardCard`, `deleteBoardCard`, `clearBoardCards` |
| `actions` | `actions` |
| `terminal` | `terminalSessions`, `renameTerminal` |

Unrefined procedures include five Remote administration/listener procedures, eight Files/Search
procedures, four Git procedures (including Review Inbox), most Review lifecycle/evidence/comment
transitions, five Actions mutations/trust, and every Project Data procedure.

## Authenticated WebSocket inventory

| Message/registration | Owner | Current path | Finding |
| --- | --- | --- | --- |
| `app-event: feature-view`, `comments`, `layers`, `evidence` | `review` | `review/review-watch.ts` → `app-events.ts` → `net/session.ts` | Coarse broadcast notification. |
| `app-event: board` | `board` | same | Coarse broadcast notification. |
| `app-event: actions` | `actions` | same | Coarse broadcast notification. |
| `app-event: scope` | `files` | same | Coarse broadcast notification. |
| `app-event: working-tree`, `file-tree` | `files` | `fs/file-watch.ts` → session sender | Targeted session signals, but the public union does not distinguish them from broadcasts. |
| `watch:files`, `watch:dirs` | `files` + `support:session` | `net/session.ts` → `fs/file-watch.ts` | Imperative per-session registrations, without declarative interest/reconnect model. |
| `session:hello` | `support:session` / Remote display | `net/session.ts` | Session protocol, not a product action. |
| `terminal:create`, `attach`, `detach`, `write`, `resize`, `kill` | `terminal` | `net/session.ts` → `terminal/terminal-manager.ts` | Stateful stream commands. |
| `terminal:paste-image`, `paste-file`, and created/attached/data/exit/paste replies | `terminal` | `net/session.ts` → image-paste/manager | Stateful stream/request-reply; attach plus scrollback is current real recovery behavior. |

`ws-protocol.ts` validates present messages but has no epoch, sequence, typed notification catalog,
affected-query map, declarative subscription manager or distinct stream catalog. `Session.send(channel,
...args)` is an untyped legacy shuttle shaped after Electron `WebContents.send`.

## Daemon module map

Every existing non-test daemon source module is represented below, grouped by current responsibility.

| Owner | Exact modules |
| --- | --- |
| `support:daemon composition/transport` | `apps/daemon/src/server.ts`; `api.ts`; `trpc.ts`; `app-events.ts`; `cli-install.ts`; `dev-config.ts`; `repo-config.ts` |
| `remote` | `net/admin-token.ts`; `net/daemon-http.ts`; `net/daemon-identity.ts`; `net/daemon-version.ts`; `net/funnel.ts`; `net/lan.ts`; `net/tailnet.ts`; `net/tailnet-listener.ts`; `stores/access-store.ts` |
| `support:persistence/session` | `net/home-channel.ts`; `net/project-channel.ts`; `net/session.ts`; `net/static-server.ts` |
| `files` | `fs/evidence-assets.ts`; `fs/evidence-paths.ts`; `fs/external-url.ts`; `fs/file-watch.ts`; `fs/fs-ops.ts`; `fs/image-mime.ts`; `fs/move-to-trash.ts`; `fs/path-expand.ts`; `fs/read-limits.ts`; `stores/scope-store.ts` |
| `git` | `git/browse.ts`; `git/commit-generation.ts`; `git/conventions.ts`; `git/diff.ts`; `git/git-env.ts`; `git/git.ts`; `git/linked-worktree.ts`; `git/working-tree.ts` |
| `review` | `git/worktree-inbox.ts`; `review/doc-set.ts`; `review/evidence-assets-list.ts`; `review/feature-build.ts`; `review/feature-explore.ts`; `review/feature-key.ts`; `review/feature-slice.ts`; `review/feature-view.ts`; `review/flow-build.ts`; `review/flow.ts`; `review/review-set.ts`; `review/review-watch.ts`; `stores/comment-store.ts`; `stores/evidence-store.ts`; `stores/feature-snapshot-store.ts`; `stores/layers-store.ts`; `stores/reviewed-store.ts`; `stores/review-store.ts` |
| `search` | `search/fuzzy.ts`; `search/search-candidates.ts`; `search/suggestions.ts` |
| `terminal` | `terminal/image-paste.ts`; `terminal/initial-input.ts`; `terminal/scrollback-buffer.ts`; `terminal/terminal-env.ts`; `terminal/terminal-manager.ts` |
| `board` | `stores/board-store.ts` |
| `actions` | `stores/actions-store.ts`; `stores/action-trust-store.ts` |
| `project-data` | `stores/notes-store.ts`; `project/companion-disposition.ts`; `project/git-exclude.ts` |
| `project-data` / `legacy/delete` | `project/migrate-active-review.ts`; `project/migrate-home.ts` |
| `support:config` / `ambiguous` | `stores/config-store.ts` |

Notable oversized or boundary-heavy modules: `git/commit-generation.ts` (991 lines), `git/git.ts`
(947), `router/review.ts` (412), `review/feature-view.ts` (370), `terminal/terminal-manager.ts`
(351), `net/daemon-http.ts` (325), `git/diff.ts` (316), `review/doc-set.ts` (313),
`stores/evidence-store.ts` (312), `net/tailnet-listener.ts` (305), and `stores/review-store.ts`
(300). The line count is an inventory signal, not a proposal to split them mechanically.

## Current boundary debt and unresolved owners

| Exact path | Current violation/finding |
| --- | --- |
| `router/files.ts` | Direct Node filesystem, trash/image/evidence helpers, Git search and scope store. |
| `router/repos.ts` | Direct Node, Git, config, scope, Project Data migration and Review watcher. |
| `router/git.ts` | Git facade/trash/cache plus Review marks and flow builders. |
| `router/review.ts` | Direct Node file read, Git facade, Review builders and five stores. |
| `router/network.ts` and `router/daemon.ts` | Router-owned host effects, validation, expected errors and access/session behavior. |
| `net/session.ts` | Transport switch calls Files watcher and Terminal manager/paste adapters directly. |
| `stores/review-store.ts` | Persistence imports Git force-stage and Project Data publication disposition. |
| `net/project-channel.ts` | Generic persistence imports Project Data migration/Git-exclude and Review watcher policy. |
| `repo-config.ts` / `<userData>/config.json` | `ambiguous`: Projects recents and Remote listener flags share one record. |
| `review/flow.ts`, `review/flow-build.ts`, `stores/layers-store.ts` | `ambiguous`: Review grouping language serves Git Changes/History. |
| `review/feature-snapshot-store.ts` | `ambiguous`: derived Review projection versus authoritative state. |
| `fs/evidence-assets.ts`, `fs/evidence-paths.ts` | Review intention with Files path/sandbox capability. |
| `search/suggestions.ts` | `ambiguous`: may be Search or Git advice; callers need classification. |

## Clean-cutover classification

| Current behavior | Disposition |
| --- | --- |
| `project/migrate-home.ts`, home-record files, `project/migrate-active-review.ts`, flat active-review paths | `legacy/delete`: pre-launch storage migration. |
| `stores/review-store.ts:reviewSetsPath`, `stores/scope-store.ts:resolveScopePath`, contracts `router.ts` tombstone | `legacy/delete`: transition aliases/shims. |
| Coarse `AppEvent`, `Session.send(channel, ...args)`, legacy Evidence `medium: 'html'`/`index.html`/`hasReport`, `reviewEvidenceDocs` historical name | `legacy/delete` in the bounded protocol/evidence cutover. |
| `repo`, `repoPath`, `openRepoPath`, `feature*`, `clearFeatureReview`, `feature-view.json` | Canonical-vocabulary migration inputs; do not retain aliases after their atomic Decision 015 cutover. |
| Atomic tmp+rename, corrupt-file backup, resource caps, authentication, session reconnect, watch recovery, terminal scrollback/reattach | Retain as real resilience/security behavior; each needs an explicit domain/supporting owner and target proof. |

