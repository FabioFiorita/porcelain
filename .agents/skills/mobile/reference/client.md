# Client structure

## Where code goes

```
src/app/        route table only — thin files that re-export a feature screen
src/features/   one folder per feature (shell, poc, files, changes, review, …)
src/components/ shared presentational components
src/lib/daemon/ the only daemon seam
```

Never co-locate components, types or utilities under `src/app` — it holds routes and `_layout` files
and nothing else. A new screen is a file in `src/features/<feature>/<name>-screen.tsx` plus a
one-line route that default-exports it. File names are kebab-case.

## Product roles by form factor

| Form | Role |
|------|------|
| **iPhone / Android phone** | Companion to Mac / iPad / browser — glance, review, stage/commit, terminal, light board |
| **iPad / Android tablet** | Full workstation alternative — web-like chrome with primary · supplementary · viewer · companion |

## The tab shell (iPhone + Android phone)

Five tabs — uses the iOS ceiling. Android phones share the same shell.

| Tab slot | Faces (re-tap root to flip) | Chrome |
|----------|------------------------------|--------|
| **Files** | Files · **Search** | full header; Search auto-focuses the keyboard; stay until re-tap |
| **Changes** | Changes · **History** | same header; no back chevron |
| **Review** | Review · **Board** | same |
| **Terminal** | Terminal | full header |
| **Settings** | Settings | header without workspace chips |

Faces live in `useTabFaces` (`features/shell/tab-faces.ts`) — **not the URL**. Opening Companion
or project/branch/worktree sheets must **not** reset the face. The tab bar is the only switcher.
Label/icon follow the store. Search is a face (not a permanent nav-bar field) so it does not fight
title + workspace for vertical space.

**Not tabs**

| Surface | Placement |
|---------|-----------|
| Companion | Form sheet from header bolt (right-rail analogue) |
| Board / History / Search | Dual-face alternates of Review / Changes / Files |
| Repo / branch / worktree pickers | Form sheets from the workspace line |

NativeTabs has no long-press menu API; **re-tap while focused on the tab root** opens the
alternate (`useTabRootFocus` gates re-tap so pushed children do not flip the face).

### Header contract (phone)

```
[ Title                          ⚡ ]
[ project · branch · worktree      ]
```

Workspace is **under** the title, never mid-toolbar. No gear (Settings is a tab). No environment
chip (lives in Settings → Environments). Bolt opens the companion sheet on every tab for the
Chrome pass; individual surfaces may drop it later when their inline content covers the same job.

## Tablet shell (iPad + Android tablet)

Root entry: `features/shell/tablet-shell` — **no bottom tab bar**.

| Column | Role |
|--------|------|
| **Primary** | Destinations: Files, Changes, Review, History, Search, Board, Terminal |
| **Supplementary** | List / controls for the active destination |
| **Secondary (viewer)** | File · diff · review · history · search results · board · terminal canvas |
| **Companion (inspector)** | Right rail; content follows active surface |

**iOS:** `expo-router/unstable-split-view` (primary + supplementary columns, auto Slot secondary,
inspector). **Android tablet:** shared four-column flex shell with the same roles (native SplitView
is iOS-only; non-iOS SplitView degrades to Slot).

### Header (tablet)

```
[ Project ▾ ] [ Search ]     Environment name     [ Branch ▾ ] [ Worktree ▾ ] [ Companion ] [ Settings ]
```

Project, search, branch, worktree, and settings open **mock sheets** today; daemon wiring later.
Settings is **never** a primary-rail destination — gear / footer control → sheet with **General ·
Review · Environments**.

### Companion titles (match web)

| Surface | Companion |
|---------|-----------|
| Files | Pinned & notes |
| Changes | Commit (+ quick commands, comments) |
| Review | Now reading (+ comments) |
| History | Timeline (+ git commands) |
| Search | Recent searches |
| Board | Focus |
| Terminal | Actions |

### Outer layer vs inner features

`features/shell` owns chrome, mock lists, viewer placeholders, and sheets. Feature folders fill
supplementary lists, viewer canvases, and companion sections without inventing a second shell.

## Glance

When Review has no published unit of work, the tab shows **Glance** — work in flight and jump
rows (desktop empty-viewer home, phone-sized).

## Daemon seam

Unchanged: `src/lib/daemon/` only, hand-declared procedures, zod-parsed, no `AppRouter` import,
WS frames from `@porcelain/contracts`, credentials in Secure Store.

## UI primitives

NativeWind v5, Tailwind CSS v4, `react-native-css`, and React Native Reusables provide the shared
React Native UI on iOS and Android. iOS 26+ native navigation is an iOS-only enhancement; Android
uses the shared phone shell and system navigation; Android tablet uses the shared multi-column shell.
