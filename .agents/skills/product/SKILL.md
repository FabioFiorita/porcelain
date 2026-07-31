---
name: product
metadata:
  internal: true
description: What Porcelain is (where agent work becomes trusted work), who it's for, pillars, core features, and product principles. Read when designing features/UI or prioritizing.
---

# Porcelain — product

**Where agent work becomes trusted work.**

Porcelain is the lightweight **review layer for agentic coding**: a macOS app plus a
browser viewer served by the daemon, which runs anywhere Node does, Linux included.
A native Expo client for the same daemon is in development, not shipped.
A **focused companion**, not a
cockpit: not an agent host and not an IDE. Agents keep writing where they already
write; Porcelain is where you read, annotate, and sign off.

## Who it is for

Engineers already serious about coding agents whose bottleneck is **reading and trusting** what shipped — often in monorepos, often with a second machine as compute. Not "AI for non-engineers"; not an IDE; not a second agent host.

## Pillars (priority order when designing or prioritizing)

1. **Review depth** (the moat): the Review (Intent · Execution · Evidence), flow-ordered diffs, comments both ways, explore-a-flow, monorepo hide/pin.
2. **Remote as a product** (second moat): one token-gated daemon; local app, remote environment, or any browser (including mobile). State and PTYs daemon-side.

There is no third pillar. Agents run in a terminal — Porcelain's or any other — and feed the Review through the CLI. Do not rebuild an in-app agent runner.

## Core features

- **File viewer** — fast, no extensions. Text files are *always editable* in place with debounced autosave — no edit button, no mode toggle — but nothing editor-like: no autocomplete, no multi-file refactors, no format-on-save. Markdown gets a Reader/Source toggle. Split view is deliberately two panes, no recursive grids.
- **Scoped navigation** — works in huge monorepos (~50 GB); folders can be hidden/pinned so only relevant apps are visible (CLI `scope`), and agents can set that focus for the human. Core differentiator: nothing else hides irrelevant parts of a monorepo.
- **Git** — diffs, worktrees, history, per-file staging, and an in-app commit composer — no terminal.
- **Flow-ordered review** — review a diff as a *timeline of connected layers*, not an alphabetical file list. Layers are **agent-managed per tree** (CLI `layers get|set|reset`), not a fixed React stack: unconfigured repos start with small **Docs + Agents** starters and everything else lands in Other until the agent (or the human in Settings → Review layers) configures ordered groups entry-point → data. Core differentiator alongside folder hiding.
- **The Review (feature view)** — the **start → mid → end home** for a unit of work (feature, bug, chore, investigation), not a post-hoc dump after shipping. Agent-authored canvas in three tabs: **Intent** (*What is this, and what's the idea?*), **Execution** (*What did the agent touch, and is the code right?* — **only** the files the agent listed, in the agent's order, never an auto-dump of every dirty path), **Evidence** (*Did it actually work?* — HTML proof plus structured pass/fail checks). All three follow the agent's publish exactly. **Lifecycle:** start = Intent-first (`review clear`, then `review set`); during = grow Execution; end = full Execution + Evidence, handing off to Changes rather than a second commit UX; after = Clear, which drops review set and evidence directory together. **Review** = one active story per repo; **Board** = the queue. No automatic baseline — an empty canvas is start-of-unit, not a dead end. Fed through the porcelain CLI + **porcelain-companion** skill.
- **Explore a feature's flow** — comprehension, not review: read an existing feature's flow read-only, no agent needed. Seed from a **symbol** (the precise unit — a routing file holds many features, so seed the route's *handler*) or coarsely from a **file**. Heuristic, no LSP: it follows relative imports, so it won't auto-cross the client→server seam (that stays the agent's `shipped` files). *Find references* shows who calls a symbol; *Explore flow* shows what it uses.
- **Review comments** — annotate a line range or a whole file while reviewing; the notes flow to your coding agent via the porcelain CLI, and it marks each resolved. The app→agent counterpart to the agent→app review set.
- **Project board** — a per-repo todo/doing/done kanban the agent reads and updates via the porcelain CLI, so it picks up queued work and reflects progress. The planning counterpart to the Review and review comments.
- **Companion surfaces** — per-repo scratchpad (Notes) and pinned files: *companion* features, not editor features.
- **Embedded terminal + actions** — a real terminal lives in the app, so an agent CLI runs next to the review surfaces; a remote-bound window can also open shells on **This device**. **Actions** are saved named commands the agent curates via the porcelain CLI, but only you *run* one. Git quick-commands/commit still run inline, not through a shell.
- **Remote access / environments** — one daemon, reached by a local Mac app, a Mac window pointed at another host (Settings → **Remotes**), or any browser it serves. The Expo client is a fourth client of that same daemon, not a new backend. **Each window or device picks its own environment.** Companion data is carried Mac ↔ remote by the coding agent through the companion skill, not a Settings seed UI. Reachability: trusted-home LAN (opt-in, cleartext), private Tailscale, or public HTTPS through opt-in Tailscale Funnel. **Connection is a one-time link, access is per device:** a local Mac uses Settings → **Share**, a headless host uses the daemon CLI; links expire after 15 minutes and exchange once for an individually revocable device credential. Share is absent from browser and remote-bound windows; new access and network changes require the host's local administrator credential.

## Principles

- **Trust over velocity:** more unreviewed agent output is not progress. Review depth beats cockpit breadth.
- **Viewer, not editor:** lightweight always wins. Quick single-file edits are in; autocomplete, rename, format-on-save, and multi-file editing stay out. Lean on the real editor.
- **Performance is a feature:** must stay fast on a 50 GB monorepo — virtualized lists/trees, lazy fs reads, never index what isn't visible.
- **Companion, not competitor:** where a best-in-class tool already exists (the editor, the agent host), integrate rather than reimplement. The test: host the surface the workflow orbits when useful (a shell next to review), never compete with a tool the user already has, pays for, and prefers. **Public copy sells Porcelain's own surfaces** — the Review, flow order, the human↔agent loop, monorepo focus, remote — not transport debates, not third-party product names, not "we don't use X."
- **Connected, not siloed:** each concern has one **canonical home** for deep work (Changes for diffs/stage/commit, Review for the canvas, Files for the tree, Board for plan, Terminal/Actions for execution). Other surfaces may **preview** a concern and must **hand off** to its home (shared `surface-handoffs`) — never a second Diff panel, second commit UX, or hidden walls "to protect identity." Identity is where deep work lives plus the quality of that home, not exclusive visibility.
- **Local by default:** review state lives on the daemon host under `~/.porcelain/`, driven by the bundled porcelain CLI. No Porcelain cloud for your code, no telemetry. Do not sell "not MCP" in public copy — a wire choice, not a product pillar.
