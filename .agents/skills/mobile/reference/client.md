# Client structure

## Contents

- **Where code goes** — the directory contract
- **Product roles by form factor** — phone vs tablet intent
- **The tab shell** (iPhone + Android phone)
- **Tablet shell** (iPad + Android tablet)
- **Glance**, **Daemon seam**, **UI primitives**

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
| **iPhone / Android phone** | Companion to Mac / iPad / browser — files, changes, history/search, terminal, and settings |
| **iPad / Android tablet** | Full workstation alternative — web-like chrome with primary · supplementary · viewer · companion |

## The tab shell (iPhone + Android phone)

Four tabs — uses the iOS ceiling. Android phones share the same shell.

| Tab slot | Faces (re-tap root to flip) | Chrome |
|----------|------------------------------|--------|
| **Files** | Files · **Search** | full header; Search field is passive until the user taps it; stay until re-tap |
| **Changes** | Changes · **History** | same header; no back chevron |
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
| History / Search | Dual-face alternates of Changes / Files |
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
| **Primary** | Destinations: Files, Changes, History, Search, Terminal |
| **Supplementary** | List / controls for the active destination |
| **Secondary (viewer)** | File · diff · history · search results · terminal canvas |
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
Environments**.

### Companion titles (match web)

| Surface | Companion |
|---------|-----------|
| Files | Pinned paths |
| Changes | Commit (+ quick commands, comments) |
| History | Timeline (+ git commands) |
| Search | Recent searches |
| Terminal | Actions |

### Outer layer vs inner features

`features/shell` owns chrome, mock lists, viewer placeholders, and sheets. Feature folders fill
supplementary lists, viewer canvases, and companion sections without inventing a second shell.

## Glance

When the selected Project has no open detail, the viewer shows **Glance** — work in flight and
jump rows (desktop empty-viewer home, phone-sized).

## Daemon seam

Unchanged: `src/lib/daemon/` only, hand-declared procedures, zod-parsed, no `AppRouter` import,
WS frames from `@porcelain/contracts`, credentials in Secure Store.

## UI primitives

NativeWind v5, Tailwind CSS v4, `react-native-css`, and React Native Reusables provide the shared
React Native UI on iOS and Android. iOS 26+ native navigation is an iOS-only enhancement; Android
uses the shared phone shell and system navigation; Android tablet uses the shared multi-column shell.
