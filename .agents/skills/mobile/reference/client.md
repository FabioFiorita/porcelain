# Client structure

## Where code goes

```
src/app/        route table only — thin files that re-export a feature screen
src/features/   one folder per feature (files, changes, review, board, terminal, settings, glance, companion)
src/components/ shared presentational components
src/lib/daemon/ the only daemon seam
src/theme/      shared design values (colors.tint is the single accent)
```

Never co-locate components, types or utilities under `src/app` — it holds routes and `_layout` files
and nothing else. A new screen is a file in `src/features/<feature>/<name>-screen.tsx` plus a
one-line route that default-exports it. File names are kebab-case.

## Product roles by form factor

| Form | Role |
|------|------|
| **iPhone** | Companion to Mac / iPad / browser — glance, review, stage/commit, terminal, light board |
| **iPad** | Full workstation alternative to the Mac app and browser — three-column SplitView + inspector |

## The tab shell (iPhone)

Four primary tabs — the iOS ceiling is five; we stay under it.

| Tab slot | Faces (re-tap root to flip) | Chrome |
|----------|------------------------------|--------|
| **Files** | Files · **Search** | full header; Search auto-focuses the keyboard |
| **Changes** | Changes · **History** | same header; no back chevron |
| **Review** | Review · **Board** | same |
| **Terminal** | Terminal | full header |

Faces live in `useTabFaces` (not the URL). Opening Settings/Companion does **not** reset the face.
The tab bar is the only switcher. Label/icon follow the store. Search is not a nav-bar field —
it is a face so it does not fight title + workspace for vertical space.

**Not tabs**

| Surface | Placement |
|---------|-----------|
| Settings | Form sheet from header gear |
| Companion | Form sheet from header (right-rail analogue) |
| Board | Pushed from Review (and re-tap Review while on root) |
| History | Pushed from Changes (and re-tap Changes while on root) |
| Repo picker | Form sheet |
| Search | Files search bar |

NativeTabs has no long-press menu API; **re-tap while focused on the tab root** opens the
alternate. Header actions mirror the same destinations. When a long-press API lands, wire it to
the same `TAB_ALTERNATES` table in `src/lib/tab-alternates.ts`.

### Header contract (phone)

```
[ Title          ]     [ surface actions ] [ Companion ] [ Settings ]
[ Workspace ▾    ]     (project · branch · worktree under the title)
```

Workspace is **under** the title, never mid-toolbar. Environment selection stays in Settings.

## iPad shell

Root `SplitView` (`expo-router/unstable-split-view`), **no bottom tab bar**:

| Column | Content |
|--------|---------|
| Primary | Destinations (Files, Changes, History, Review, Board, Terminal + Settings/Project) |
| Supplementary | List for active destination (Files tree today; others deepen as lists extract) |
| Secondary (Slot) | Detail / canvas from the route table |
| Inspector | Companion (iOS 26+) |

SplitView is root-only (cannot nest). Same feature screens and daemon seam as phone.

## Companion

Content follows `useActiveSurface()` (last focused product surface):

| Surface | Companion |
|---------|-----------|
| Changes / History | Commit composer + quick commands (`ActionsScreen`) |
| Review | Comments + Board entry |
| Board | Focus card |
| Terminal | Saved Actions |
| Files | Pins & notes (stub until pins land) |

## Glance

When Review has no published unit of work, the tab shows **Glance** — work in flight and jump
rows (desktop empty-viewer home, phone-sized).

## Daemon seam

Unchanged: `src/lib/daemon/` only, hand-declared procedures, zod-parsed, no `AppRouter` import,
WS frames from `@porcelain/contracts`, credentials in Secure Store.

## UI primitives

`@expo/ui/swift-ui` + `/modifiers` only. iOS 26+ deployment target. No Android.
