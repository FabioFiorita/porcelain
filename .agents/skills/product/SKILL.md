---
name: product
metadata:
  internal: true
description: What Porcelain is (where agent work becomes trusted work), who it's for, pillars, core features, and product principles. Read when designing features/UI or prioritizing.
---

# Porcelain — product

**Where agent work becomes trusted work.**

Porcelain is the lightweight **review layer for agentic coding** (a macOS app, plus a browser viewer served by the daemon — which runs anywhere Node does, Linux hosts very much included). Not an editor: your agents run in your terminal, and Porcelain is where you review what they built. Agents write faster than anyone can trust; Porcelain stands on the trust side of that pile.

Public pitches and launch copy live in `plans/launch-narrative.md`. Competitive notes and roadmap in `plans/positioning-and-roadmap.md`.

## Who it is for

Engineers already serious about coding agents (Claude Code, Codex, OpenCode, Grok) who feel the bottleneck is **reading and trusting** what shipped, often in monorepos, often with a second machine as compute. Not an "AI for non-engineers" product; not an IDE replacement.

## Pillars (priority order when designing or prioritizing)

1. **Review depth** (the moat): the Review (Intent · Execution · Evidence), flow-ordered diffs, comments both ways, explore-a-flow, monorepo hide/pin.
2. **Remote as a product** (second moat): one token-gated daemon; local app, remote environment, or any browser (including mobile). State and PTYs daemon-side.

There is no third pillar. "Running agents" was one until 2026-07-27; the in-app runner is gone and agents run in a terminal (Porcelain's or any other), feeding the Review through the CLI either way.

## Core features

- **File viewer** — fast, no extensions. Text files are *always editable* in place (plain textarea over a Shiki backdrop, debounced autosave — no edit button, no mode toggle), but nothing editor-like: no autocomplete, no multi-file refactors, no format-on-save. Markdown gets a Reader/Source toggle.
- **Split view** — view two files side by side. Deliberately just two panes (no recursive grids) — enough to compare or read-while-editing without becoming an IDE.
- **Scoped navigation** — works in huge monorepos (~50 GB); folders can be hidden/pinned so only relevant apps are visible. Core differentiator: no existing tool lets you hide irrelevant parts of a monorepo.
- **Git** — diffs, worktrees, history, per-file staging, and an in-app commit composer (quick commands + suggestions, no terminal).
- **Flow-ordered review** — review a diff as a *timeline of connected layers*, not an alphabetical file list. A feature change is a straight line (e.g. component → query call → route → controller → service → module → Prisma); Porcelain orders/groups changed files along that dependency flow so the reviewer reads the change as a story from entry point to database. Core differentiator alongside folder hiding.
- **The Review (feature view)** — review the *whole feature* as one agent-authored canvas, not just your diff. When you've only touched part of a feature (e.g. the client half) the diff can't show the rest. Your coding agent publishes **the Review** in three tabs: **Intent** (*What is this, and what's the idea?* — thesis + walkthrough prose / optional freeform HTML or Excalidraw board), **Execution** (*What did the agent touch, and is the code right?* — flow-ordered files with notes; open as diff/file), **Evidence** (*Did it actually work?* — HTML proof only, plus structured pass/fail checks). It lives in the **Review** sidebar tab (Cmd+3): pills for Intent · Execution · Evidence, shortcuts for Intent and Evidence, and an **inline Execution** file outline so the human can open files while Intent/Evidence fill the viewer. J/K step Intent chapters; Z is zen. There is **no automatic baseline** — without a published review set the tab shows "No review yet" (copyable agent prompt). Fed through the porcelain CLI + **porcelain-companion** skill (Intent / Execution / Evidence under that skill's references). Clear removes the review set and the evidence directory together; Evidence also has its own Clear. Companion skills ship via skills.sh; CLI installs on every launch.
- **Explore a feature's flow** — comprehension, not just review: point Porcelain at an existing feature and read its flow read-only, no changes and no agent needed. Seed from a **symbol** (the precise unit — a routing file holds many features, so you seed the route's *handler*, not the file) or coarsely from a whole **file**. Heuristic (no LSP): it follows relative imports, so it won't auto-cross the client→server seam (that's still the agent's `shipped` files). *Find references* shows who calls a symbol; *Explore flow* shows what it uses.
- **Review comments** — annotate a line range or a whole file with a note while reviewing; the notes flow to your coding agent via the porcelain CLI as concrete context, and it can mark each resolved once addressed. Add them from the diff/source right-click ("Add comment" / "Comment on file"); manage them in the Comments Quick Access section. The app→agent counterpart to the feature view's agent→app review set — both keep the human and the agent looking at the same feature.
- **Project board** — a per-repo todo/doing/done kanban (Board sidebar tab + a wide viewer board). Your coding agent reads and updates it via the porcelain CLI (list/create/update/move/delete cards), so it can pick up queued work and reflect progress without you spelling everything out in chat — the planning counterpart to the feature view and review comments.
- **Companion surfaces** — per-repo scratchpad (the Notes card, a TipTap WYSIWYG) and pinned files, so the things you care about during a review session stay one glance away. These are *companion* features, not editor features.
- **Embedded terminal + actions** — a real terminal lives in the app (the **Terminal** sidebar tab, Cmd+7), so you can run `claude` next to the review surfaces instead of in a separate Ghostty/Warp window. **Actions** are saved named commands shown in the Terminal tab's Quick Access — one click runs one in a terminal (e.g. a dev server). Actions are a two-way agent channel: your coding agent curates them via the porcelain CLI, but only you *run* one. (This reverses an earlier "companion to the terminal, never a terminal" stance — decided 2026-06-16; the consolidation into one window won out. Git quick-commands/commit still run inline, not through a shell.)
- **Remote access / environments** — the same client, three ways in: the Mac app on a local daemon, the Mac app pointed at a remote daemon (Settings → Environments), or any browser served by the daemon itself (including on mobile; there is no separate mobile app). **Each window picks its own environment** (local project in one window, remote box in another) — environments are not app-global. Companion data (actions/commands, notes, board, flow layers, review comments, hidden/pinned folders) is carried Mac ↔ remote by the coding agent via the **porcelain-companion** skill (`references/sync-environments.md` — porcelain CLI + SSH/path remap) — not a Settings seed UI. Two networks reach the browser surface: on your home network the daemon can bind the LAN directly (no Tailscale needed — same Wi-Fi, opt-in, token-gated but cleartext on the LAN), and the tailnet covers away-from-home (WireGuard-encrypted). One token-gated daemon surface either way; PTYs and review state live daemon-side, so they survive reconnects and follow you across devices. **Adding a device is pairing, not token archaeology** — Settings opens a short-lived code as a link + QR; scanning it on a phone lands on that daemon's browser client already connected, and pasting it into the Mac app saves the environment in one field.

## Principles

- **Trust over velocity:** more unreviewed agent output is not progress. Review depth beats cockpit breadth.
- Viewer, not editor: lightweight always wins. Quick single-file edits are in (2026-06-12), but autocomplete, rename, format-on-save, and multi-file editing are still out — the IDE features. Lean on the real editor for those.
- Performance is a feature: must stay fast on a 50 GB monorepo — virtualized lists/trees, lazy fs reads, never index what isn't visible.
- Companion, not competitor: where a best-in-class tool already exists (the editor, the agent CLI), Porcelain integrates with it rather than reimplementing it. Two things were argued in-house and only one stayed. The **terminal** came in (2026-06-16) and stays: running `claude` in the same window beat staying terminal-free. The **agent runner** came in on 2026-07-11 ("viewer + agent companion" → "the hub for agentic coding") and was **reversed on 2026-07-27**: reimplementing the CLIs cost ~18k lines and a 40% fix rate in 16 days for a surface its author used twice, and the Review is fed by the porcelain CLI, not by in-app threads — an agent in *any* terminal publishes the same Review. So Porcelain is **the review layer for agentic coding**: your agents run in your terminal. The test that separates the two calls: host the surface the workflow orbits (a shell), not a competitor to a tool the user already has, already pays for, and already prefers (the editor, the agent CLI).
- **Connected, not siloed (2026-07-21):** each concern has one **canonical home** for deep work (Changes for diffs/stage/commit, Review for the Review canvas, Files for the tree, Terminal/Actions for execution). Other surfaces may **preview** that concern when useful and must **hand off** to the home (shared `surface-handoffs`) — never a second Diff panel, second commit UX, or hidden walls “to protect identity.” Identity is where deep work lives + quality of that home, not exclusive visibility.
- **Local by default:** agent channels are watched local files + a bundled CLI (`~/.porcelain/porcelain`). No MCP port, no Porcelain cloud for your code, no telemetry.

