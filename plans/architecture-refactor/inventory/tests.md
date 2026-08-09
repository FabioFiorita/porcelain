# Test inventory

**Status:** current-state evidence for the architecture-refactor decision program. This records
what the suite proves today and the tests future migrations will require; it is not a target
testing manual.

**Scope and measurement:** on 2026-08-09, `rg --files -g '*.{test,spec}.{ts,tsx}'` found **235**
test/spec source files. `apps/desktop/vitest.config.ts` runs the unit suite from one Vitest/jsdom
configuration; `apps/desktop/playwright.config.ts` runs browser and optional Electron assembled
system tests. Counts are files, not assertions. Decision 011 supplies the target boundaries.

## Suite distribution

| Runtime / package | Files | Current locations | Predominant risk covered |
| --- | ---: | --- | --- |
| `apps/daemon` | 66 | `src/{fs,git,net,project,review,search,stores,terminal}` and config/packaging | Pure policy/parsing, real temporary filesystem/Git stores, host/network adapters, WebSocket dispatch, narrow HTTP/router behavior. |
| `apps/cli` | 14 | `apps/cli/src/*.test.ts` | CLI noun parsing and repo-local companion files/documents. |
| `apps/desktop` main | 3 | `src/main/{local-terminal-paths,remote-daemon,renderer-packaging}.test.ts` | Local mapping persistence, endpoint ordering and packaging configuration. |
| `apps/desktop` E2E | 12 specs | `apps/desktop/e2e/*.spec.ts` | Daemon-served browser wiring, optional Electron-native paths, terminal round trips, selected UI journeys, live refresh and visual regression. |
| `apps/web` | 87 | 43 component, 8 hook, 20 lib, 12 store, 4 Ghostty | React presentation, hook/query behavior, Zustand state, WebSocket/terminal characterization and viewer/terminal rules. |
| `apps/mobile` | 41 | 1 component, 31 feature, 9 `lib` | Mostly pure feature/store rules plus daemon client/session/provider/error/pairing characterization. |
| `packages/client-runtime` | 9 | one colocated test per exported module | Shared pure utilities and session-protocol helpers. |
| `packages/shared` | 3 | `platform`, `porcelain-home`, `project-porcelain` | Cross-runtime platform/path and companion policy. |
| No matching tests | 0 | `packages/contracts`, `packages/ui`, `apps/mobile/modules/porcelain-terminal`, root `scripts` | No `*.test.*`/`*.spec.*` sources were found. |

`apps/desktop/e2e/marketing.shots.ts` runs separately through `playwright.shots.config.ts`; it is
screenshot/review proof rather than one of the 12 normal regression specs.

## Current boundaries and proof

### Domain pure behavior

| Evidence | Risks actually proved | Gap / target ownership under Decision 011 |
| --- | --- | --- |
| Git: `apps/daemon/src/git/{diff,conventions,browse,working-tree,linked-worktree,worktree-inbox}.test.ts`; Search: `search/{fuzzy,search-candidates,suggestions}.test.ts`; Review: `review/{feature-key,feature-slice,flow,flow-build,feature-build,feature-explore,feature-view,doc-set,evidence-assets-list}.test.ts`. | Git parsing/grouping/traversal, search ranking, Review keying/document/flow construction and selected invariants without transport. | These will remain direct canonical Git, Search and Review domain-rule tests. Current `feature` folders/names are migration inputs, not target language. Some tests mix policy with filesystem/Git setup and will be separated only where the risk warrants it. |
| Utility/policy tests: `fs/{external-url,image-mime,fs-ops,path-expand,read-limits}.test.ts`, `net/{daemon-identity,daemon-version,funnel,lan,tailnet}.test.ts`, `terminal/{initial-input,scrollback-buffer,terminal-env}.test.ts`. | URL safety, MIME/binary classification, path/limit, remote identity/address parsing and terminal buffer/environment behavior. | Files, Remote and Terminal policies will remain at their lowest pure owner; generic utility names will not dictate ownership. |
| `packages/client-runtime/src/{commit-message,companion-disposition,highlight,paths,session-protocol,terminal-keys,terminal-touch-scroll,word-diff-line,word-diff-tokens}.test.ts`. | Shared commit prefix, disposition, path/highlight, session URL/backoff/watch union, terminal interaction and diff transforms. | Good direct-unit template. Client-runtime has no domain query identity, mutation consequence/optimism, notification, public-error or session state-machine tests because it has no such layer yet. Those risks will move here when the shared behavior exists. |
| `packages/shared/src/{platform,porcelain-home,project-porcelain}.test.ts`; `apps/desktop/src/main/{local-terminal-paths,remote-daemon}.test.ts`; Web/mobile feature pure tests. | Platform/path/disposition, endpoint editing, selection/reducer/formatting, source/diff row, viewer and terminal rules. | Endpoint semantics and some pure behavior are duplicated across desktop, mobile and contracts. Future migrations will select one correct owner (`shared`, contracts, client-runtime, domain or presentation support) rather than share by caller count. |

### Daemon operations, persistence, and adapters

The daemon has no Decision-003 application-operation seam today. No existing test can truthfully be
classified as a direct operation test; the following are the current closest behavior boundaries.

| Evidence | Risks actually proved | Boundary today | Target test ownership |
| --- | --- | --- | --- |
| Stores: `apps/daemon/src/stores/{access-store,actions-store,action-trust-store,board-store,comment-store,evidence-store,feature-snapshot-store,layers-store,notes-store,reviewed-store,review-store,scope-store}.test.ts`. | Real persisted document CRUD, archive/restore, containment/corruption, disposition, marks, scope and trust rules; many use isolated temp roots. | Persistence adapter and domain behavior coupled in store tests. | Future domain policy and operation tests will use focused fakes/in-memory capabilities; real storage representation will keep targeted integration tests. |
| Git: `apps/daemon/src/git/{git,commit-generation}.test.ts`. | Temporary repos prove range diff, mutations, worktrees, head/log/push, binary/image diffs, file log, reviewed fingerprints, environment scrub and commit style. | Focused real-Git integration, with mixed behavior assertions. | Retain controlled real-Git adapter proof. Multi-domain intentions will gain operation tests rather than expand Git tests into workflow suites. |
| Files/project: `fs/{evidence-assets,file-watch,move-to-trash}.test.ts`, `project/{companion-disposition,git-exclude,migrate-active-review,migrate-home}.test.ts`, `terminal/image-paste.test.ts`. | Temp filesystem assets, trash, watcher caps/filtering, companion visibility/Git exclusion, historical migration and attachment write/cleanup. | Adapter/integration mixed with compatibility/migration behavior. | Retain filesystem safety, containment, bounds and real failure proof. Decision 015 will remove migration-only paths/tests after version-1 target state is proven. |
| Terminal: `terminal/terminal-manager.test.ts`; `net/session.test.ts`. | Fake `node-pty` lifecycle/caps/retention/kill, sender dispatch, terminal messages and watcher cleanup. | Stateful manager/adapter with fakes. | Terminal operations and shared stream state will gain direct tests; node-pty integration will remain a distinct external-resource boundary. |
| Remote/network/config: `net/{admin-token,daemon-http,home-channel,static-server,tailnet-listener,ws-protocol}.test.ts`, `dev-config.test.ts`, `repo-config.test.ts`, `cli-install.test.ts`, `trash-packaging.test.ts`. | Tokens/config, static serving/CSP, channel caching, listener failures, session protocol, daemon HTTP auth/CORS/WS upgrade/dispatch and packaging/install behavior. `daemon-http.test.ts` starts real HTTP/WS with a mocked terminal manager. | Adapter plus narrow assembled-router proof. | Auth, CORS, pairing/session and static-serving integration tests will remain. Routers will gain narrow contract-to-operation/output/error tests, not own business regressions. |

### Contracts, routers, and public transport

| Evidence | Risks actually proved | Current gap | Target boundary |
| --- | --- | --- | --- |
| `apps/daemon/src/net/{ws-protocol,session,daemon-http}.test.ts`. | Selected terminal image-paste envelope/dispatch, auth gate, CORS, WS upgrade and one router surface. | `packages/contracts` has no colocated tests; `procedureIo` remains partially `z.unknown()`; no exhaustive valid/invalid procedure input/output, notification or public-error proof exists. | Contracts will own representative valid/invalid schemas/fixtures and mechanical exhaustiveness. Router tests will only prove auth, mapping, output validation, redaction and correlation. |
| `apps/mobile/src/lib/daemon/{errors,provider,app-events,client}.test.ts` and `procedures/{changes,workspace}.test.ts`. | Local response parsing, error wrapping, event invalidation, endpoint client behavior and selected hand-authored schemas. | They protect a second local wire vocabulary. Web follows router type inference, a different runtime-validation path. | Contract-valid fixtures and one mock harness will replace local schema mirrors and be reusable by Web/mobile feature adapters. |
| CLI: `apps/cli/src/{action-file,board-file,comment-file,evidence-file,feature-view-file,html-input,intent-file,layers-file,notes-file,reviewed-file,review-file,scope-file}.test.ts`, `cli.test.ts`, `skill-commands.test.ts`. | Current companion document/file format, CLI dispatch and noun behavior. | Several protect Feature aliases or historical storage forms alongside durable file safety. | Target operations/adapters will protect current formats. Decision 015 will delete compatibility-only tests and retain target-format, corruption and safety proof. |

### Web and mobile presentation/adapters

| Evidence | Risks actually proved | Gap / target boundary |
| --- | --- | --- |
| Web components: 43 files under `apps/web/src/components/{git,settings,shell,terminal,ui,viewer}/*.test.tsx`. | DOM rendering, controls, view composition, accessibility labels, settings/remote affordances, terminal menus, source/HTML/text viewers. | Git contains Git, Search and Review; Shell/Settings contain domain controls. Fixtures often import daemon types. Canonical-domain feature tests will use contract-valid daemon mocks; Shell/Viewer/UI stay supporting-region presentation proof. |
| Web hooks: `apps/web/src/hooks/use-{board,comments,diff,feature-reading,git-flow,history,repo,worktrees}.test.ts` with `hooks/trpc-test-harness.tsx`. | Query inputs, mutation calls, selected cache behavior and error propagation through typed tRPC terminating links. | Hooks test router-derived types, not contract-valid outcomes; invalidation/optimism is only partial and shared semantics are absent. App adapters will test real hooks over public mocks; identities/effects/optimism will be direct runtime tests. |
| Web libraries/stores: 20 `lib` and 12 `stores` tests; `terminal/ghostty/{keyCodes,renderer,runtimeAbi,surface}.test.ts`. | Zustand interactions, session/local-daemon routing/recovery, terminal registry/input/rendering and Web-specific behavior. | Global store paths hide product ownership; session semantics duplicate mobile. Ghostty remains Web-only, not candidate shared behavior. |
| Mobile features: 31 tests under `apps/mobile/src/features/*`, plus `components/surface-layout.test.ts` and `lib/clipboard.test.ts`. | Predominantly pure Changes/Comments/Diff/Files/History/Review/Settings/Shell/Terminal transforms, stores and native-terminal wrappers. | Little rendered React Native feature coverage, no discovered mobile source E2E, and current folders split/misplace canonical domains. Significant UX behavior will get contract-mock-backed feature tests; native view/gesture risks remain mobile adapter proof. |
| Mobile daemon: `apps/mobile/src/lib/daemon/{app-events,client,environment,errors,pairing,provider}.test.ts` plus procedure tests. | Environment persistence/corruption, pairing/endpoints, query provider/invalidation, WebSocket client errors and local descriptor schemas. | It duplicates shared-runtime behavior and its string invalidations differ from Web. Mobile will retain storage/network/foreground proof while shared query/error/notification/session semantics move to client-runtime. |

## E2E and visual evidence

| Spec group | Risks actually proved | Future role under Decision 011 |
| --- | --- | --- |
| `e2e/{smoke,glance,sidebar-frame,theme,shortcuts}.spec.ts` | Built daemon-served browser boots, seeded state appears, selected tabs/UI, responsive glance, shortcuts and theme wiring. | Keep named browser/runtime risks; move ordinary UI branches and pure behavior to lower boundaries. |
| `e2e/{live-refresh,review-publish,companion-data,evidence,share}.spec.ts` | Filesystem watcher → viewer refresh, CLI → Review/Evidence integration, companion Git disposition, evidence rendering and local-vs-browser administration. | Retain only unique cross-process risks after operations, adapters and contract-backed features are established. |
| `e2e/terminal.spec.ts` | Real daemon/PTY/browser stream, paste/image/file transfer, action launch, touch behavior and optional native Electron clipboard/selection. | Keep as a small stateful-stream wiring suite; terminal manager/protocol edge cases belong below E2E. |
| `e2e/visual.spec.ts` and snapshots; `marketing.shots.ts` | Stable layout snapshots and marketing/review screenshots. | Keep visual regression where layout is the risk. Screenshots without stable assertions remain review evidence, not functional regression proof. |

The normal Playwright `browser` project drives the daemon-served built renderer—the same client
Electron loads. The `electron` project is macOS-local native-shell proof, not the primary CI lane.
The present E2E suite is broader than the eventual intentionally small wiring suite.

## Duplication, gaps, and migration consequences

| Finding | Evidence | Future consequence |
| --- | --- | --- |
| No operation backbone | Daemon tests concentrate on stores, Git/filesystem helpers, managers and transport boundaries. | Each representative migration will add direct operation tests with focused capabilities. Router/E2E tests will stop duplicating business branches. |
| Contracts lack direct proof | Zero contract package test files and incomplete I/O schemas. | Contract fixtures, invalid-shape rejection and exhaustive catalog checks are foundation work before client mock migration. |
| Client mocks are split | Web has typed tRPC `trpc-test-harness.tsx`; mobile uses local descriptor/provider fixtures. | One contract-valid public mock harness will support both clients where transport adapters allow, without encoding daemon business logic. |
| Cross-client semantics have no common tests | Web event switch/hook mutations diverge from mobile `APP_EVENT_INVALIDATIONS` and procedure-name arrays. | Client-runtime will own direct query identity, mutation consequence/optimism, notification and reconnect/subscription tests. |
| Compatibility and resilience tests are mixed | CLI/project migration and legacy Evidence/environment parsing sit beside corruption, URL, watcher and resource-limit proof. | Each cutover will classify tests: delete historical compatibility-only coverage; retain explicitly named corruption, recovery, security, resource and platform cases. |
| E2E overlaps lower layers | Smoke, shortcuts, terminal and visual specs cover some branch-level UI behavior. | Preserve assembled risks only; relocate ordinary business/UI assertions after confirming no unique wiring risk remains. |

Future specifications will name each behavior, its lowest complete owner, the current test retained,
and any test removed or relocated. “Add unit tests” and “add E2E” will be insufficient. Operations
will use focused fakes; real adapters will use controlled external resources; contracts will validate
the public wire; clients will use contract-valid mocks; E2E will remain the final, small wiring lane.
