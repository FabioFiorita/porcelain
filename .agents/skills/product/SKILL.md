---
name: product
description: What Porcelain is, who it's for, its core features and product principles. Read when designing features, UI, or prioritizing work.
---

# Porcelain — product

A lightweight macOS-first **viewer and agent companion**, not an editor. The user manages coding agents from the terminal; Porcelain fills the gaps that currently force opening Cursor/Zed/GitHub Desktop.

## Core features

- **File viewer** — fast, no LSP, no extensions. Text files are *always editable* in place (plain textarea over a Shiki backdrop, debounced autosave — no edit button, no mode toggle), but nothing editor-like: no autocomplete, no multi-file refactors, no format-on-save. Markdown gets a Reader/Source toggle.
- **Split view** — view two files side by side. Right-click a file in the tree (or a tab) → "Open to the Side" splits the viewer into two panes, each with its own tabs; the divider is drag-resizable. Closing a pane's last tab collapses back to one. Deliberately just two panes (no recursive grids) — enough to compare or read-while-editing without becoming an IDE.
- **Scoped navigation** — works in huge monorepos (~50 GB); folders can be hidden/pinned so only relevant apps are visible. Core differentiator: no existing tool lets you hide irrelevant parts of a monorepo.
- **Git** — diffs, worktrees, history, per-file staging, and an in-app commit composer (quick commands + suggestions, no terminal).
- **Flow-ordered review** — review a diff as a *timeline of connected layers*, not an alphabetical file list. A feature change is a straight line (e.g. component → query call → route → controller → service → module → Prisma); Porcelain orders/groups changed files along that dependency flow so the reviewer reads the change as a story from entry point to database. Core differentiator alongside folder hiding.
- **Feature view** — review the *whole feature*, not just your diff. When you've only touched part of a feature (e.g. the client half) the diff can't show the rest, because the other files didn't change and the client→server seam isn't an import edge. The feature view widens the change: the no-MCP **baseline** adds the unchanged files your changes reach by relative import (tagged `context`); the **MCP** path lets your coding agent — which built the feature and knows its boundary — push the cross-seam `shipped` files and annotate the invariants to check. Same flow-ordered grouping either way. It lives in its own **Feature** sidebar tab (Cmd+4) — the navigation list; the MCP path additionally unlocks an inline **reading surface** that renders the whole feature as one document showing just the relevant lines (diff hunks for changed files, symbol slices for the rest). The agent feeds it through a standalone stdio MCP server (`src/mcp/`), distributed as a one-click **Claude Code plugin** (Settings → "Claude Code plugin") that bundles the server and a review skill; the app never opens a network port.
- **Companion surfaces** — per-repo scratchpad (the Notes card, a TipTap WYSIWYG) and pinned files, so the things you care about during a review session stay one glance away. These are *companion* features, not editor features.
- **Terminal companion, not a terminal** — Porcelain deliberately has NO embedded terminal (it can't beat Ghostty/Warp and shouldn't try). Git actions it offers (quick commands, commit) run directly in-app with output shown inline.

## Principles

- Viewer, not editor. Lightweight always wins. Reject features that turn it into an IDE. Quick single-file edits are in (decided 2026-06-12); LSP, autocomplete, and multi-file editing are still out. The one sanctioned rich-text editor is the Notes card (a companion surface) — never the file viewer.
- Performance is a feature: must stay fast on a 50 GB monorepo — virtualized lists/trees, lazy fs reads, never index what isn't visible.
- Companion, not competitor: where a best-in-class tool already exists (the terminal, the editor), Porcelain integrates with it rather than reimplementing it.
