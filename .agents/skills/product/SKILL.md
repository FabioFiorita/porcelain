---
name: product
description: What Porcelain is, who it's for, its core features and product principles. Read when designing features, UI, or prioritizing work.
---

# Porcelain — product

A lightweight macOS-first **viewer and agent companion**, not an editor. The user manages coding agents from the terminal; Porcelain fills the gaps that currently force opening Cursor/Zed/GitHub Desktop.

## Core features

- **File viewer** — fast, no LSP, no extensions. Text files are *always editable* in place (plain textarea over a Shiki backdrop, debounced autosave — no edit button, no mode toggle), but nothing editor-like: no autocomplete, no multi-file refactors, no format-on-save. Markdown gets a Reader/Source toggle.
- **Scoped navigation** — works in huge monorepos (~50 GB); folders can be hidden/pinned so only relevant apps are visible. Core differentiator: no existing tool lets you hide irrelevant parts of a monorepo.
- **Git** — diffs, worktrees, history, per-file staging, and an in-app commit composer (quick commands + suggestions, no terminal).
- **Flow-ordered review** — review a diff as a *timeline of connected layers*, not an alphabetical file list. A feature change is a straight line (e.g. component → query call → route → controller → service → module → Prisma); Porcelain orders/groups changed files along that dependency flow so the reviewer reads the change as a story from entry point to database. Core differentiator alongside folder hiding.
- **Companion surfaces** — per-repo scratchpad (the Notes card, a TipTap WYSIWYG) and pinned files, so the things you care about during a review session stay one glance away. These are *companion* features, not editor features.
- **Terminal companion, not a terminal** — Porcelain deliberately has NO embedded terminal (it can't beat Ghostty/Warp and shouldn't try). Git actions it offers (quick commands, commit) run directly in-app with output shown inline.

## Principles

- Viewer, not editor. Lightweight always wins. Reject features that turn it into an IDE. Quick single-file edits are in (decided 2026-06-12); LSP, autocomplete, and multi-file editing are still out. The one sanctioned rich-text editor is the Notes card (a companion surface) — never the file viewer.
- Performance is a feature: must stay fast on a 50 GB monorepo — virtualized lists/trees, lazy fs reads, never index what isn't visible.
- Companion, not competitor: where a best-in-class tool already exists (the terminal, the editor), Porcelain integrates with it rather than reimplementing it.
