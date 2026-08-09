# Client inventory

**Status:** inventory evidence for the architecture-refactor decision program. This records the
current Web, mobile, and client-runtime shapes and the migration work they will require; it is not
target-state contributor documentation or implementation authorization.

**Scope:** `apps/web`, `apps/mobile`, and `packages/client-runtime`, assessed against accepted
Decisions 001–015 on 2026-08-09. The canonical product keys are `projects`, `files`, `git`,
`search`, `review`, `board`, `actions`, `terminal`, `project-data`, and `remote`.

## Topology and primary findings

| Region | Current evidence | Migration implication |
| --- | --- | --- |
| `packages/client-runtime` | Dependency-clean, nonvisual package with nine exported leaf utilities: `commit-message`, `companion-disposition`, `highlight`, `paths`, `session-protocol`, `terminal-keys`, `terminal-touch-scroll`, `word-diff-line`, and `word-diff-tokens`. Every module has a colocated unit test. | It will remain the shared nonvisual application layer but has no domain query, mutation, notification, error, or session semantics yet. Domain subpaths will be introduced only for behavior genuinely shared by Web and mobile. |
| Web request transport | `apps/web/src/lib/trpc.ts` creates typed `AppRouter` HTTP tRPC clients and a separate Electron `ShellRouter`; `apps/web/src/lib/query.tsx` owns one QueryClient. | tRPC, React Query, and the shell channel will be retained. Product code will stop relying on daemon router inference and direct daemon types. Shell RPC will remain a supporting native adapter. |
| Web session transport | `apps/web/src/lib/daemon.ts` owns a per-endpoint WebSocket, reconnect, whole-set watch replay, session hello, terminal correlation and reattachment; `lib/local-daemon.ts` creates a second local session when needed. | The platform socket implementation will stay Web-owned, while reusable session, watch, notification-recovery and terminal-stream semantics will move behind client-runtime capability-shaped APIs. Terminal streams will not be made Query data. |
| Mobile client seam | `apps/mobile/src/lib/daemon/{client,procedure,queries,provider,session,watch,terminal,environments-store}.ts(x)` implements descriptors, query keys, response parsing, errors, reconnect, watches, and streams. | This is the principal extraction source for client-runtime. React Native, Secure Store, foreground state, WebSocket, navigation, and query-adapter mechanics will remain mobile-owned. |
| Contracts | `packages/contracts/src/procedures/names.ts` is exhaustive by name, but `procedures/io.ts` falls back to `z.unknown()` when `refined.ts` has no schema. | Contracts will become the exhaustive runtime input/output/event/error vocabulary before mobile schema mirrors and Web `AppRouter` coupling are removed. |
| Boundary debt | 89 Web source files import `@backend/*`; 9 import `@main/*`. Product hooks import tRPC directly. Mobile feature code commonly imports generic `@/lib/daemon/*` APIs and descriptors directly. | Web daemon/persistence types will be replaced by contract-inferred wire types or explicit local view models. Both apps will get domain feature adapters over shared semantics, without moving UI code to client-runtime. |

## Product-domain map

| Domain | Web evidence | Mobile evidence | Current wire / semantic debt | Required shared semantics |
| --- | --- | --- | --- | --- |
| `projects` | `components/shell/{project-switcher,project-switcher-menu,repo-picker-dialog,sidebar-header-actions}.tsx`; `hooks/use-repo.ts`; `stores/{repo,repo-picker}.ts`. | `features/shell/{project-sheet,workspace-picker,workspace-lists,use-workspace}.ts(x)` and `app/(files)/*`. | `procedures/connection.ts` locally defines `daemonInfo`, `recentRepos`, `openRepoPath`, browse, remove and revoke descriptors; Web imports backend `RepoInfo`. `repo`/`workspace` are active aliases. | Project identity and keys; open/select/remove-recent mutation effects. Browse will be distinguished from Files tree reads. Opening a Project will remain a daemon operation, not a client store write. |
| `files` | Tree/commands in `components/shell/{file-tree,tree-node,file-commands,file-finder,file-prompt-dialog,pinned-group,files-quick-access}.tsx`; Viewer in `components/viewer/*`; `hooks/use-files.ts`; `stores/{file-tree,tree-dirs,file-prompt,reveal}.ts`. | Colocated `features/files/*`: browser, list, viewer, prompts, scope/pins, source rows and previews. Search is incorrectly mixed in this folder. | `procedures/files.ts` locally declares 14 descriptors and mirrored schemas. Web `use-files.ts` contains write/create/rename/duplicate/trash/scope invalidation choices. | Tree, pins, scope, file content and preview identities; exact write/path mutation effects; scoped Files watch consequences. DOM/RN viewer, dialog and prompt state will remain app-local. |
| `git` | `components/git/*` mixes Changes, diffs, commits, history, branches and worktrees; hooks `use-{git-flow,commit,diff,diff-reading,history,worktrees,branch-flow}.ts`; stores `commit-draft.ts`, `selection.ts`. | `features/{changes,diff,history}/*`; branch/worktree UI in `features/shell/*`; stores `changes-store.ts`, `commit-draft-store.ts`, `history-store.ts`. | `procedures/changes.ts` has 20 descriptors; `workspace.ts` defines branch/worktree descriptors and string invalidation arrays. Contract coverage is partial. `changes`/`history` are presentation aliases. | Typed flow/status/diff/history/branch/worktree identities; exact checkout versus add-worktree effects; shared pure commit-prefix, Head, and diff transforms. Git mutations will normally be non-optimistic. |
| `search` | `hooks/use-search.ts`; `components/git/search-list.tsx`; shell `content-search.tsx`, `search-quick-access.tsx`, `file-finder.tsx`. | `features/files/{search-companion,search-list,search-panel,search-phone-screen,search-highlight}.tsx`. | Mobile search schemas live in `procedures/files.ts`; contracts refine only file search; Web imports backend search/Git types. | Search input/key normalization and exact file-change effects for file/text/code search. Keyboard, query fields, phone sheets and result rendering will remain app-owned. |
| `review` | Historical names dominate `components/git/{feature-list,feature-view,review-view,review-inbox,review-doc-body,reading-surface,evidence-*,comment-*,explore-view}.tsx`; hooks `use-{feature-view,feature-reading,review-intent,evidence,comments,reviewed,explore}.ts`; stores `review-focus.ts`, `review-start.ts`. | `features/review/*`, but comments are in `features/comments/*` and reading primitives are split through `features/diff/*`. | `procedures/review.ts` is a 414-line local Review schema catalog, includes Board, and preserves `Feature*` types; contracts leave `featureReading` as `z.unknown()`. | Active/archive/reading/intent/evidence/comment/reviewed/inbox identities; mutation effects; comment-index, lifecycle and evidence pure rules. Visual canvas/document rendering will not be shared. |
| `board` | `components/board/*`; `hooks/use-board.ts`; `stores/{board-selection,card-draft}.ts`. | `features/board/*`, `board-store.ts`, `review-handoff-store.ts`. | Board descriptors/types live in mobile `procedures/review.ts`; contracts already own `boardCardSchema`; Web imports daemon Board types. | Board key and card mutation effects; pure reconciliation/order only where one behavior exists. Review-to-Board server work will be an explicit cross-domain operation if it must be atomic. |
| `actions` | `components/terminal/{actions-group,action-composer,action-trust-dialog}.tsx`; `hooks/use-actions.ts`; `stores/action-run.ts`. | Action command UI is split among `features/changes/{quick-commands-card,commit-card}.tsx` and `features/terminal/terminal-command-composer.tsx`. | Mobile `actions`/`trustActions` live in `procedures/terminal.ts`; add/update/move/delete are absent from mobile. Web imports daemon `Action*` types. | Action list/trust keys and effects; nonvisual command-run preparation. Running will remain an explicit Actions → Terminal workflow, not a shared UI hook. |
| `terminal` | `components/terminal/*`; `hooks/use-terminal-channel.ts`; `stores/{terminals,terminal-input}.ts`; `lib/{daemon,local-daemon,terminal-registry,terminal-actions,terminal-clipboard,terminal-keys,terminal-osc52,terminal-touch-scroll}.ts`; Web renderer `terminal/ghostty/*`. | `features/terminal/*`, `terminal-store.ts`, `terminal-input-store.ts`, `lib/daemon/terminal.ts`, and `modules/porcelain-terminal/*`. | Contracts own message schemas but not epoch/sequence or category distinctions. `terminalInfoSchema`/`actionSchema` are duplicated in mobile and contracts; Web independently implements the stream lifecycle. | Session/stream state, attachment/recovery/correlation semantics and roster identities; existing key/touch pure behavior belongs here. Ghostty/native views, clipboard, gestures, routes and device file selection will stay platform-local. |
| `project-data` | Settings `components/settings/{companion-section,data-section,flow-layers-section}.tsx`; `hooks/use-{companion-dispositions,repo-notes,repo-layers}.ts`; `stores/preferences.ts`. | `features/settings/{data-panel,review-layers,review-panel,use-review-editor,use-settings}.ts(x)` and `preferences-store.ts`. | Mobile descriptors are split among `procedures/{companion,notes,settings}.ts`; Web imports backend project/review types. `client-runtime/companion-disposition.ts` is already a pure shared leaf. | Companion disposition/visibility, notes, layers and preference keys/effects. Settings will aggregate controls, not own their behavior. Client preference persistence will get an explicit versioned storage owner. |
| `remote` | Settings `remotes-section.tsx`, `share-section.tsx`; `hooks/use-{daemon-identity,remote-daemon,share,lan,tailnet,funnel,token-gate}.ts`; session identity in `lib/daemon.ts`. | `features/settings/{environments-panel,environment-forms,group-detail,pair-environment,use-environments-panel,environment-chrome}.ts(x)`; technical state in `lib/daemon/{environment,environments-store,provider,pairing,client,session}.ts(x)`. | Contracts own endpoint kind/order and daemon-info only. Mobile persists version 3 environments and converts legacy `box` icon to `desktop`; Web Remote mixes shell RPC and daemon HTTP. | Endpoint selection/order, daemon identity, public error/session/recovery semantics and notification recovery. Secure Store, localStorage, Electron bridge, pairing UI and foreground policy remain app adapters. |

## Supporting regions

| Region | Current evidence | Migration boundary |
| --- | --- | --- |
| `shell` | Web `components/shell/*`, `stores/{tabs,zen,unread,setup-tips,file-finder,repo-picker,settings-dialog}.ts`, shortcut/responsive hooks; mobile `features/shell/*` and Expo `app/*` routes. | Will retain navigation, panes, tabs, overlays and windows. Product semantics currently embedded here will move to their domain slices. |
| `viewer` | Web `components/viewer/*` and Git reading/document components; mobile File, Review and Diff bodies. | Will remain UI/platform implementation. Only pure input transformations such as paths, syntax tokens and diff ranges may be shared. |
| `settings` | Web `components/settings/*`; mobile `features/settings/*`. | Will remain an aggregator. Its Files, Git, Review, Project Data and Remote behaviors will be owned by their domains. |
| `ui` | Web `components/ui/*`; mobile `components/ui/*` and chrome/layout primitives. | Will remain generic visual primitives and tokens; product hooks/schemas will not move here. |
| desktop shell RPC | Web `shellTrpc` in `lib/trpc.ts`, plus update/window/skills/local-terminal/remote hooks. | Will remain a narrow Electron-native adapter, separate from daemon product domains. |
| native terminal | Web `terminal/ghostty/*`; mobile native terminal module and native/xterm views. | Will remain platform implementation, not a second product domain. |

## State, query, mutation, and realtime evidence

| Concern | Web | Mobile | Required destination |
| --- | --- | --- | --- |
| Server truth | One QueryClient in `lib/query.tsx`; each global `hooks/use-*.ts` embeds its procedure/input/key semantics. | `lib/daemon/queries.ts` uses `['daemon', environmentId, procedureName, input]`, `useDaemonQuery`, `useDaemonQueries`, and `useDaemonFetch`. | React Query will remain the owner. Client-runtime will own typed domain query identities and freshness semantics; app adapters will include environment identity in concrete keys. |
| Mutations | Hook-local effects in `use-files`, `use-board`, `use-actions`, `use-commit`, `use-comments`, `use-reviewed`, `use-worktrees`, Review, Project Data and Remote hooks. | `useDaemonMutation` takes `invalidates?: string[]`; features/procedure modules declare string lists such as `WORKSPACE_CHECKOUT_INVALIDATIONS`. | Client-runtime will define per-domain affected identities, reconciliation and selective optimism. Components will not select cache keys or invalidations. |
| Optimism | `use-comments.ts` and `use-reviewed.ts` cancel, snapshot, set, roll back, then refetch. | Matching mobile features invalidate but have no shared optimistic definitions. | Review pure transitions/rollback/reconcile will be tested in client-runtime before adapters apply them. Optimism will remain opt-in and will not be used for unpredictable host effects. |
| Presentation workflows | Web has 20 horizontal Zustand stores; domain state is mixed with shell state. `stores/repo.ts` contains a selected Project object. | Stores are mostly colocated by feature; remote environments are a technical global store. | Stores will move/remain with their domains and hold only drafts, selections or cross-component presentation workflows. Daemon data will not be mirrored from Query. |
| Notifications | `hooks/use-app-events.ts` maps the `AppEvent` enum through one large invalidation switch; reconnect does global `utils.invalidate()`. | `lib/daemon/app-events.ts` maps the same events to `Record<AppEvent, string[]>`; `provider.tsx` applies it. | Contracts will define typed domain notifications; client-runtime will map notifications exhaustively to typed query identities; each app will apply that mapping once. |
| Watches and recovery | Web session remembers whole file/dir sets and replays them after reconnect. | Mobile `watch.ts` reference-count-like registrations union paths; `session.ts` replays hello/watches and handles foreground reconnect. | A shared declarative interest model will retain app platform socket behavior, deduplicate interests, re-register after reconnect, and distinguish socket health from watch coverage. |
| Stateful streams | Web `lib/daemon.ts` and `use-terminal-channel.ts` attach/rehydrate terminal streams; registry and Ghostty are Web-local. | `lib/daemon/terminal.ts` owns request correlation, attachments and stream subscription. | Terminal will stay a stateful stream category with explicit reattach/scrollback recovery, not a notification or broad Query invalidation. |
| Expected errors | Web hooks expose tRPC errors and `onMutationError` copy. | `lib/daemon/errors.ts` creates local `DaemonError` kinds and exposes daemon message text. | Contract-owned typed public errors plus a client-runtime parser/classifier will replace local text/error-class interpretation. |

### Observed notification and invalidation divergence

| Signal | Web behavior | Mobile behavior | Migration requirement |
| --- | --- | --- | --- |
| `feature-view` | Invalidates `featureView`, `featureReading`, `exploreFeature`. | Invalidates `featureView`, `featureReading`, `worktreeInbox`. | A Review-scoped notification will map to one typed, reviewed set of query identities. |
| `layers` | Invalidates layers, Git flows and multiple Review reads. | Invalidates only `repoLayers`. | Cross-domain consequences will be declared visibly and shared, not inferred from app event strings. |
| `scope` | Invalidates tree, pins, scope, Git flow and file search. | Invalidates tree, pins and scope. | Files/Search consequences will become precise typed identities. |
| `working-tree` | Invalidates read/preview/diff/explore; Git flow self-polls. | Broadly invalidates status, flows, diffs, history-related reads, marks and files. | Files and Git change facts will be separated and each query will declare watch/poll/focus coverage. |
| `file-tree` | Invalidates tree, pins and Git flow. | Invalidates tree, search and pins. | Files and Search mappings will be reconciled from actual affected data. |
| Board/actions/comments | One direct query invalidation per event. | Equivalent direct string mappings. | These simple domain mappings provide a low-risk early exemplar. |
| Git checkout / add worktree | `use-worktrees.ts` contains manual invalidation. | Distinct broad/narrow string arrays in `procedures/workspace.ts`. | Git mutation semantics will retain the meaningful distinction in one shared definition. |

## Contract, schema, and compatibility inventory

| Item | Evidence | Classification and cutover implication |
| --- | --- | --- |
| Incomplete wire definitions | `packages/contracts/src/procedures/{names,io,refined}.ts`; `unknownIo` is used for unrefined procedures. | Target contract work. Procedures/events/errors will receive exact runtime schemas before client mirrors are deleted. |
| Mobile mirrors | `apps/mobile/src/lib/daemon/procedures/{changes,companion,connection,files,notes,review,settings,terminal,workspace}.ts`. | Target deletion. These recreate procedure names, Zod schemas and inferred types; canonical domain contract modules will replace them. |
| Repeated shapes | Contracts and mobile duplicate Flow, diff, file status/view/entry, terminal, action, Board, Review comment, branch/worktree, Evidence document/asset shapes. | Contracts will own serializable public shapes. Presentation enrichments will remain app/runtime transformations. |
| Web server models | Web imports `@backend/api`, `@backend/git/*`, `@backend/review/*`, `@backend/stores/*`, and `@backend/search/*` throughout hooks, stores, components and tests. | Target deletion. No application/persistence model will cross this runtime boundary. |
| Review aliases | `featureView`, `featureReading`, `clearFeatureReview`, `exploreFeature`; Web `feature-*` paths and mobile `Feature*` types. | Pre-launch compatibility debt: rename atomically to Review vocabulary or delete aliases; do not preserve a completed-domain alias. |
| Project aliases | `repo`, `repos`, `RepoInfo`, `repoPath`, `openRepoPath`, and mobile `workspace`. | Pre-launch compatibility debt: canonicalize Project while keeping Git worktree distinct. Exact public/storage names will be enumerated by each cutover spec. |
| Misplaced current terms | `changes`/`history` are Git surfaces; mobile Search is Files; mobile Board is Review; Actions is Terminal; Settings is treated as an owner. | Structural migration input, not public compatibility: relocate by Decision 013 ownership. |
| Active compatibility behavior | Evidence accepts legacy `medium: 'html'`; mobile `environment.ts` converts `box` to `desktop`; environment reader/writer retains version 3 and missing-icon defaults; `contracts/router.ts` is a stale-import failure alias. | Historical compatibility will be removed in bounded Decision 015 cutovers. Real resilience will remain: corruption diagnostics, explicit target version 1 state, session reconnect, watches, terminal recovery, endpoint failure handling and bounded polling. |
| Web re-export wrappers | `apps/web/src/lib/{commit-message,highlight,paths,terminal-keys,terminal-touch-scroll,word-diff}.ts` mostly pass through client-runtime exports. | No-op wrappers will be removed; `terminal-touch-scroll.ts` may remain only for actual DOM-listener adaptation. |

## Shared pure behavior candidates

| Existing module / rule | Future owner |
| --- | --- |
| `client-runtime/commit-message.ts`, `word-diff-line.ts`, `word-diff-tokens.ts` | Git/Viewer-support pure semantics. Contract line shapes will replace structural duplicates where they cross the wire. |
| `client-runtime/companion-disposition.ts` | Project Data pure semantics. |
| `client-runtime/{paths,highlight}.ts` | Files/Viewer support unless a demonstrated server consumer makes them `shared`. |
| `client-runtime/{terminal-keys,terminal-touch-scroll}.ts` | Terminal semantics; DOM/RN gesture plumbing remains app-local. |
| `client-runtime/session-protocol.ts` | Remote/session/Terminal support; it will grow through injected capabilities, never browser/RN socket imports. |
| Web comments/reviewed optimistic transforms | Review mutation semantics with direct runtime unit tests. |
| Mobile `lib/daemon/{queries,app-events,procedure,errors}.ts` | Source material for client-runtime query identities, notification mapping, contract invocation and public-error parsing. |
| Mobile pure feature modules (file paths/names, diff rows, review lifecycle, commit staging/tokens, terminal naming/engine/composer) | Individually classify by semantic identity; similar-looking UI code will not move merely because two callers exist. |

## Test ownership inventory

| Boundary | Current evidence | Required future boundary |
| --- | --- | --- |
| Client-runtime | Nine colocated utility tests. | Domain query identity, mutation consequence/optimism, notification mapping, public error and session/subscription state-machine tests will run directly here. |
| Web hooks | `hooks/use-{board,comments,diff,feature-reading,git-flow,history,repo,worktrees}.test.ts` use `hooks/trpc-test-harness.tsx`. | Web feature tests will use a contract-valid daemon mock harness and real app adapters, not router types or hook/store internals. |
| Web UI/session | Extensive `components/{git,settings,shell,terminal,viewer}/*.test.tsx`, store tests, and `lib/{daemon,local-daemon,terminal-registry,terminal-actions,terminal-clipboard,terminal-osc52,terminal-touch-scroll}.test.ts`. | UI tests will remain presentation evidence; session tests will split shared semantics from Web adapter behavior. |
| Mobile transport | `lib/daemon/{app-events,client,environment,errors,pairing,provider}.test.ts`, plus Changes/Workspace procedure tests. | Adapter tests will retain platform transport, storage and recovery risks; shared semantics will stop being proven only here. |
| Mobile UI | 41 tests, primarily pure feature/store modules across Changes, Comments, Diff, Files, History, Review, Settings, Shell and Terminal. | Significant feature behaviors will gain contract-mock-backed rendered tests. No mobile source E2E was found in this inventory. |
| Contracts | Runtime schemas/catalog exist, with no inspected colocated contract tests. | Valid/invalid procedure, notification and public-error fixtures will prove the wire boundary. |
| E2E | Web system E2E is outside this slice (`apps/desktop/e2e`). | E2E will stay a small wiring suite: startup/auth, a critical request, reconnect/subscription recovery and terminal streaming. |

## Migration implications and exemplar candidates

Completed domain cutovers will include contracts, client-runtime semantics, participating Web/mobile
adapters, tests, and removal of their old schemas/aliases. Temporary two-path client semantics will
not survive a completed domain under Decision 015.

1. **Board** will be a simple read/mutation/notification exemplar: both clients have focused UI,
   contracts already have `boardCardSchema`, and mobile Board-in-Review placement can be removed.
2. **Review comments** will be the optimistic mutation exemplar: Web already characterizes
   add/edit/delete/resolve/clear behavior and mobile has the same product surface.
3. **Files** will be the realtime exemplar: tree/write/watch identities, scoped interest
   registration, recovery and `working-tree`/`file-tree` consequences can be made explicit.
4. **Git checkout/add-worktree** will be the multi-query mutation exemplar: preserve mobile's
   broad/narrow distinction while reconciling Web behavior without optimistic Git claims.
5. **Terminal** will be the cross-client stateful-stream exemplar: share protocol/recovery
   semantics only, retain Ghostty and native implementation.
6. **Remote/error/protocol** will follow exhaustive contracts: replace `DaemonError`, direct
   `AppRouter` leakage, raw `AppEvent`, and historical persisted/wire representations in one
   versioned clean cutover.

All specifications will preserve the existing authenticated HTTP tRPC and authenticated session
socket topology; they will classify each fallback as compatibility deletion, resilience, product
default, or bounded temporary scaffolding. They will not add shared React hooks, a second
transport, client-side multi-mutation orchestration, or browser/native imports to client-runtime.
