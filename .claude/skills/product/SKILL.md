---
name: product
description: What Porcelain is, who it's for, its core features and product principles. Read when designing features, UI, or prioritizing work.
---

# Porcelain — product

A lightweight macOS-first **viewer and agent companion**, not an editor. The user manages coding agents from the terminal; Porcelain fills the gaps that currently force opening Cursor/Zed/GitHub Desktop.

## Core features

- **File viewer** — read-only, fast, no LSP, no extensions, no editing.
- **Scoped navigation** — works in huge monorepos (~50 GB); folders can be hidden/pinned so only relevant apps are visible. Core differentiator: no existing tool lets you hide irrelevant parts of a monorepo.
- **Git** — diffs, worktrees, history.
- **Flow-ordered review** — review a diff as a *timeline of connected layers*, not an alphabetical file list. A feature change is a straight line (e.g. component → query call → route → controller → service → module → Prisma); Porcelain orders/groups changed files along that dependency flow so the reviewer reads the change as a story from entry point to database. Core differentiator alongside folder hiding.
- **Terminal companion, not a terminal** — Porcelain deliberately has NO embedded terminal (it can't beat Ghostty/Warp and shouldn't try). Git actions it offers (quick commands, commit) run directly in-app with output shown inline.

## Principles

- Viewer, not editor. Lightweight always wins. Reject features that turn it into an IDE.
- Performance is a feature: must stay fast on a 50 GB monorepo — virtualized lists/trees, lazy fs reads, never index what isn't visible.
- Read-only by design: no file-write features in the viewer.
