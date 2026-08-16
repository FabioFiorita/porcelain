# E2E-001 assertion relocation ledger

This is the source-of-truth map for the browser-suite reduction in E2E-001. The source
references are the pre-migration files at commit `96c543f7` (the E2E-001 preflight commit),
so a reviewer can audit the complete assertion set even after the broad specs are removed.

The browser functional gate includes the four assembled wiring risks in
`critical-wiring.spec.ts` plus the daemon-backed composed acceptance proof in
`composed-proof.spec.ts`. The composed scenario covers two Environment daemons in one browser
page, Projects and Worktrees from both, target-aware tabs and splits, the Review Canvas migration
(including Evidence), Tasks, Actions, and a daemon-owned process surviving reload. Visual assertions stay in `visual.spec.ts`; Electron-only host
clipboard proof stays in `terminal-native.spec.ts`. All other assertions have a lower-boundary
owner below. “Retired” means the old browser route was redundant after the named owner was
verified; it does not mean the behavior was discarded.

## Critical assembled browser proof

| ID | Former source assertion | Replacement | Boundary proved |
| --- | --- | --- | --- |
| CW-01 | `smoke.spec.ts:3-7` — seeded repo restores into the shell and reports two dirty files | `critical-wiring.spec.ts:103-106` | Built daemon + browser client startup, auth, project recents, and first query |
| CW-02 | No former browser equivalent; protocol coverage was lower-only | `critical-wiring.spec.ts:108-116` | Real authenticated `/session` WebSocket returns exact `session:mismatch` / `protocol.update-required` for `PROTOCOL_VERSION + 1` and closes |
| CW-03 | `live-refresh.spec.ts:10-30` — an open clean file adopts an external disk rewrite | `critical-wiring.spec.ts:119-133` | Real fixture filesystem → daemon watcher → session frame → browser editor |
| CW-04 | `review-publish.spec.ts:44-143` — built CLI review write reaches an already-running Review canvas | `composed-proof.spec.ts` | Legacy migration input is read once and rendered as a daemon-root Review Canvas with Evidence in both Environment-targeted browser flows; CLI and Canvas contract tests own file shape |
| CW-05 | `terminal.spec.ts:6-24` plus the reconnect/scrollback contract from `terminal` lower tests | `critical-wiring.spec.ts:174-201` | Real PTY create, >64 KiB output, browser session detach, daemon-owned session retention, roster hydration, attach, and tail replay |

The four critical tests above remain the wiring lane. The composed proof is the cross-feature
browser lane, and the acceptance command also runs the Canvas, migration, Tasks, Actions, Hub,
and promotion specs. The terminal test deliberately
asserts the tail after reload; the exact byte/unit cap and frame ordering remain owned by
`apps/daemon/src/features/terminal/terminal-operations.test.ts:118-178`,
`apps/daemon/src/features/terminal/terminal-stream-gateway.test.ts:50-135`,
`packages/contracts/src/terminal/terminal.stream.test.ts:31-167`, and
`apps/web/src/features/terminal/terminal-stream-adapter.test.ts:101-230`.

## Source assertion ledger

Each row accounts for every logical assertion family in the twelve former browser specs.
Rows with several expectations list them together when they prove one invariant; the named
lower test is the owner of that invariant at its smallest complete boundary.

### `smoke.spec.ts`

| ID | Source assertion | Disposition and replacement |
| --- | --- | --- |
| SM-01 | `:3-7` — shell boot, seeded project, `data-count=2` | `CW-01`; assembled startup proof |
| SM-02 | `:9-15` — Changes count is 2 and `Home.tsx` / `Card.tsx` rows exist | Lower `apps/web/src/components/git/changes-list.test.tsx:134-150` owns grouped rows/count; `apps/web/src/components/shell/glance-home.test.tsx:115-135` owns dirty-tree handoff. Retired from browser as duplicate startup/status coverage |
| SM-03 | `:17-37` — All changes opens, Home diff collapses/expands, reviewed mark collapses it | `apps/web/src/features/review/reading-surface.test.tsx:84-92` owns collapsed row omission and `apps/web/src/components/git/changes-list.test.tsx:191-237` owns reviewed state/count/completion. Retired from browser after lower ownership |
| SM-04 | `:40-47` — Changes preserves the Quick Access toggle | `apps/web/src/lib/responsive-shell.test.ts:44-64` owns give-way ordering. Retired from browser; the former Board surface no longer ships |
| SM-05 | `:49-53` — Settings opens at General | `apps/web/src/components/settings/general-section.test.tsx:10-22` owns General composition; visual screenshot remains in `visual.spec.ts`. Retired from browser |
| SM-06 | `:55-62` — no seeded repo lands on Welcome | `apps/web/src/stores/project-selection.test.ts:33-62` owns open/restore/welcome modes; visual Welcome remains in `visual.spec.ts`. Retired from browser |

### `glance.spec.ts`

| ID | Source assertion | Disposition and replacement |
| --- | --- | --- |
| GL-01 | `:5-12` — 390×844 viewport lands on Glance and shows two dirty files | `apps/web/src/components/shell/glance-home.test.tsx:87-135` owns Glance content and dirty handoff; `apps/web/src/lib/responsive-shell.test.ts:30-128` owns responsive panel decisions; `visual.spec.ts` retains the browser visual lane. Retired from browser |

### `sidebar-frame.spec.ts`

| ID | Source assertion | Disposition and replacement |
| --- | --- | --- |
| SF-01 | `:12-40` — clipped container, outset ring, painted card top inside clip, inner visible | Moved verbatim in substance to `visual.spec.ts:54-76`; remains a real browser layout assertion in the visual lane |

### `theme.spec.ts`

| ID | Source assertion | Disposition and replacement |
| --- | --- | --- |
| TH-01 | `:6-27` — System resolves dark, Light removes dark/light scheme, Dark restores dark, System follows OS | `apps/web/src/lib/theme.test.ts:28-66` owns resolver/class/color-scheme transitions; `visual.spec.ts` retains General screenshot. Retired from browser |

### `shortcuts.spec.ts`

| ID | Source assertion | Disposition and replacement |
| --- | --- | --- |
| SH-01 | `:6-11` — Meta-T creates a visible Terminal 1 from the current tab | `apps/web/src/lib/keyboard.test.ts:43-69` owns terminal-host shortcut targeting; `apps/web/src/lib/terminal-actions.test.ts:5-26` owns deterministic naming; `CW-05` owns real PTY creation. Retired from browser |
| SH-02 | `:13-32` — Meta-N on Terminal creates a PTY; command runs; Meta-K clears only the local viewport | `apps/web/src/lib/terminal-actions.test.ts:5-26`, `apps/web/src/components/terminal/terminal-context-menu.test.tsx:57-87`, and `CW-05` own the action, clear, and real stream boundaries. Retired from browser |
| SH-03 | `:35-47` — Meta-N opened the retired Board composer and Meta-S saved a card | Daemon-owned Tasks and their mutations own current work capture; `apps/web/src/lib/keyboard.test.ts:74-130` owns modifier semantics. Retired from browser |
| SH-04 | `:49-72` — Meta-N file, Meta-Shift-N folder, Meta-D duplicate, Meta-Backspace trash | `apps/web/src/features/files/files-mutations.test.tsx:33-80` owns create/duplicate/trash mutation contracts and authoritative invalidation; `apps/daemon/src/features/files/files-operations.test.ts:50-180` owns filesystem facts. Retired from browser |

### `live-refresh.spec.ts`

| ID | Source assertion | Disposition and replacement |
| --- | --- | --- |
| LR-01 | `:10-30` — open `Button.tsx` contains the old prop, external write is adopted by the clean editor | `CW-03`; lower guards remain in `apps/daemon/src/features/files/files-watches.test.ts:89-140`, `apps/web/src/features/files/files-notifications.test.tsx:75-110`, and `apps/web/src/components/viewer/editor-source.test.tsx:85-155` |

### `review-publish.spec.ts`

| ID | Source assertion | Disposition and replacement |
| --- | --- | --- |
| RP-01 | `:44-95` — CLI Intent-only set appears; all four Canvas sections render with Evidence | `CW-04` owns the live CLI-to-Review-Canvas arrival and authenticated Canvas reads; `apps/cli/src/cli.test.ts:142-314` and the Projects Canvas contract tests own CLI shape and Canvas availability. |
| RP-02 | `:91-131` — second CLI set updates the same daemon-root Review Canvas | `CW-04` owns the composed migration and Canvas proof; CLI Canvas tests own replacement and invalidation shape |
| RP-03 | `:133-143` — Review Canvas Evidence renders in a sandboxed iframe with image proof | `CW-04` and `apps/daemon/src/net/canvas-http.test.ts` own the browser and HTTP containment boundaries. Retired from broad browser |

### `companion-data.spec.ts`

| ID | Source assertion | Disposition and replacement |
| --- | --- | --- |
| CD-01 | `:38-80` — tracked Actions file flips Local, is untracked and ignored, remains on disk, then Shared removes the ignore without claiming it is staged | `apps/daemon/src/features/project-data/gitignore-dispositions.test.ts:55-160`, `packages/client-runtime/src/project-data/describe-disposition.test.ts:5-31`, `apps/web/src/components/settings/data-section.test.tsx:53-103`, and `apps/web/src/features/project-data/project-data-mutations.test.tsx:187-218` own Git, copy, wording, and mutation effects. Retired from browser |
| CD-02 | `:82-99` — Companion installer is hidden in browser; Electron shows only skill commands and no data toggles | `apps/web/src/components/settings/companion-section.test.tsx:10-32` owns skill-only content; `apps/web/src/components/settings/data-section.test.tsx:116-137` owns visibility/share copy; `SUP-003` Desktop ruling remains in native shell tests. Retired from browser |

### `evidence.spec.ts`

| ID | Source assertion | Disposition and replacement |
| --- | --- | --- |
| EV-01 | `:65-81` — Review Canvas Evidence renders checks and Results | `CW-04` owns the composed Canvas Evidence proof. Retired from browser |
| EV-02 | `:83-102` — Canvas iframe is sandboxed and renders the agent-authored document | `apps/daemon/src/net/canvas-http.test.ts` and `CW-04` own the Canvas response and browser containment. Retired from browser |
| EV-03 | `:104-117` — Evidence image gallery renders agent-authored assets | `CW-04` and `apps/daemon/src/fs/evidence-assets.test.ts:18-110` own Canvas asset materialization. Retired from browser |
| EV-04 | `:119-123` — removing a legacy pack does not remove the daemon-root Canvas | Migration and Projects Canvas contract tests own one-time conversion and Canvas persistence. Retired from browser |

### `share.spec.ts`

| ID | Source assertion | Disposition and replacement |
| --- | --- | --- |
| SH-05 | `:3-11` — browser has neither Share nor Remotes host administration | `apps/web/src/components/settings/remotes-section.test.tsx:1-100` and the Desktop shell boundary tests own host-only surface selection; this is a native/browser capability split, not a daemon-served functional flow. Retired from browser |
| SH-06 | `:13-24` — Electron sees the seeded client, revoke removes it, empty state returns | `apps/desktop/src/main/shell-api.test.ts:120-210` owns the shell administration transport; `apps/web/src/components/settings/remotes-section.test.tsx:1-100` owns the renderer shape. SUP-003 ruling A keeps pairing/address book/shell-api in Desktop. Retired from browser |

### `terminal.spec.ts`

| ID | Source assertion | Disposition and replacement |
| --- | --- | --- |
| TE-01 | `:6-24` — typed command round-trip and Nerd Font load | PTY round-trip is `CW-05`; font rendering is owned by the visual/package asset lane. Retired from browser |
| TE-02 | `:27-52` — browser paste delivers command text to the PTY | `apps/web/src/lib/terminal-clipboard.test.ts:5-24`, `apps/web/src/features/terminal/terminal-stream-adapter.test.ts:101-171`, and the terminal contract tests own payload selection/stream delivery. Retired from browser |
| TE-03 | `:54-73` — context menu shows terminal actions and clear removes only local viewport text | `apps/web/src/components/terminal/terminal-context-menu.test.tsx:57-87` and terminal registry/adapter tests own neutral actions and clear. Retired from browser |
| TE-04 | `:75-100` — browser image paste uploads an attachment and inserts daemon path | `apps/web/src/lib/terminal-clipboard.test.ts:5-24`, `apps/daemon/src/features/terminal/terminal-operations.test.ts:315-335`, and `apps/daemon/src/features/terminal/terminal-stream-gateway.test.ts:120-135` own image selection, caps, and async result. Retired from browser |
| TE-05 | `:102-166` — native text/image paste, file drop, selection copy, clipboard contents | Moved to `terminal-native.spec.ts:3-60`; Electron-only by construction |
| TE-06 | `:168-191` — two terminals split side-by-side and both retain output | `apps/web/src/stores/tabs.test.ts:257-345` owns split/pane/terminal move semantics; `apps/web/src/features/terminal/terminal-roster.test.tsx:127-167` owns session binding. Retired from browser |
| TE-07 | `:194-216` — Meta-Backspace kill-line and Meta-ArrowLeft line-start reach readline | `apps/web/src/lib/terminal-keys.test.ts:13-92` owns the exact escape/control mappings. Retired from browser |
| TE-08 | `:218-231` — saved action runs in a terminal | `apps/web/src/features/actions/action-run.test.tsx:1-100` and `apps/daemon/src/features/actions/actions-operations.test.ts:120-180` own action persistence/dispatch. Retired from browser |
| TE-09 | `:234-242` — desktop pointer hides the touch key bar | `apps/web/src/components/terminal/terminal-key-bar.test.tsx:47-104` owns touch-only control rendering; no browser runtime proof is needed for this pure capability branch. Retired from browser |
| TE-10 | `:244-282` — touch key bar visible; arrows recall, sticky Ctrl sends ^C, one-tap ^C interrupts | `apps/web/src/components/terminal/terminal-key-bar.test.tsx:47-104`, `apps/web/src/lib/terminal-keys.test.ts:45-92`, and `packages/client-runtime/src/terminal-touch-scroll.test.ts` own key-bar bytes/focus and touch semantics. Retired from browser |
| TE-11 | `:6-24` + daemon stream assertions — terminal creates, writes, detaches, reconnects, and bounds replay | Consolidated as `CW-05`; lower exact cap/recovery owners are listed under the critical proof |

### `visual.spec.ts`

| ID | Source assertion | Disposition and replacement |
| --- | --- | --- |
| VI-01 | `:9-12` — empty Glance screenshot and dirty count | Kept in the visual browser lane |
| VI-02 | `:15-19` — Changes screenshot and count | Kept in the visual browser lane |
| VI-03 | `:27-35` — seven-item icon rail screenshot and count | Kept in the visual browser lane |
| VI-04 | `:39-46` — Changes Quick Access screenshot and commit control | Kept in the visual browser lane |
| VI-05 | `:49-83` — left/viewer/right painted frame geometry | Kept in the visual browser lane |
| VI-06 | `:86-90` — desktop Settings screenshot at General | Kept in the visual browser lane |
| VI-07 | `:96-146` — phone sidebar bounds, Settings chips/stack/scroll, Share capability split, screenshot | Kept in the visual browser lane; behavior assertions remain lower settings/responsive tests |
| VI-08 | `:177-185` — unseeded Welcome screenshot and no remote-admin control | Kept in the visual browser lane |

## Fixture and command relocation

| Former risk | New owner |
| --- | --- |
| `helpers/app.ts:158-161` wrote obsolete `{ recentRepos: [...] }` to `config.json`, so a strict-v1 daemon treated seeded startup as empty | `helpers/app.ts:158-170` writes `{ version: 1, value: { paths: [...] } }` to the isolated `projects-recents.json` document |
| Normal browser command ran every functional and visual spec | `apps/desktop/package.json` `test:e2e` and `test:e2e:prebuilt` run the 18-test functional acceptance lane; `test:e2e:update` is visual-only |
| Native clipboard proof was skipped in browser but lived beside browser assertions | `terminal-native.spec.ts` and native scripts target the Electron project explicitly |
| A layout geometry assertion lived in the functional browser list | `visual.spec.ts` owns it beside screenshot proof |
| Fixture daemon could touch a developer daemon/home if a test leaked paths | `helpers/app.ts` keeps per-test `PORCELAIN_HOME`, `PORCELAIN_USER_DATA`, access file, admin token, loopback OS-assigned port, and fixture repo; no production port or personal companion is used |

## Review checks

The relocation is complete only when all of the following are true:

- `pnpm --dir apps/desktop typecheck:e2e` passes.
- `pnpm --dir apps/desktop test:e2e` runs the built browser client against its per-test daemon,
  including the four critical tests and the composed/migration/task/action/worktree/Hub lanes.
- Focused lower-boundary tests named in this ledger pass.
- `pnpm lint` and `git diff --check` pass.
- The old broad functional specs are absent, while `visual.spec.ts`, `terminal-native.spec.ts`, and this ledger remain.
- The worktree is clean after the implementation commit and no push is performed.

## Run record

- Baseline: the inherited browser lane failed before the migration because the helper wrote the
  obsolete `config.json`; the daemon ignored it and the browser waited for the shell rail while
  the Welcome surface remained mounted. No product daemon or personal data was involved.
- `pnpm --dir apps/desktop typecheck:e2e` — passed.
- `pnpm --dir apps/desktop test:e2e:prebuilt` — 18/18 browser tests passed, including
  `composed-proof.spec.ts`, `hub-inventory.spec.ts`, and `hub-viewer.spec.ts`.
- `pnpm --dir apps/desktop test` — 466 test files / 3,623 tests passed (the repository test
  script ran the complete Vitest workspace while the lower-boundary command was exercised).
- `pnpm lint` — passed; `git diff --check` — passed; architecture-spec validator — passed.
- Deletion gate: the former broad functional specs are removed in the E2E-001 landing commit;
  `critical-wiring.spec.ts`, `terminal-native.spec.ts`, `visual.spec.ts`, and this ledger remain.
