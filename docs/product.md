# Porcelain — product

**Where agent work becomes trusted work.**

Porcelain is the **review layer for agentic coding**: a daemon that serves a browser client from
wherever the code lives, plus a macOS shell that loads the same client. A focused **companion**, not
a cockpit — not an agent host, not an IDE. Agents keep writing where they already write; Porcelain
is where you read what they wrote, and decide whether to trust it.

## Who it is for

Engineers who are **paid to read code** and whose reading has become the bottleneck now that agents
write it. Usually a large monorepo, most of which they will never open. Usually several agents
working in parallel, in several worktrees, at once. Not "AI for non-engineers"; not an IDE; not a
second agent host.

## The core object: the worktree

Everything is scoped to a worktree. A **profile** — which paths are pinned, which are hidden, and
which layers order the story — is set once for the project and inherited by every worktree of it.
A worktree can override it, and the agent writes that override through the companion skill and CLI
when the work needs focus of its own: a web task and a mobile task in one monorepo are different
work. Most worktrees never need one.

Worktrees are read side by side in one window. Tasks are the deliberate exception: they span
projects and worktrees, because your work does.

## Pillars

In priority order. Pillars 2 and 3 are one mechanism — the worktree profile — serving two ends.

1. **Worktree navigation.** Many worktrees legible in one window, fast to switch between. Created
   with a chosen destination and branch, running the repository's `create` hook; disposed of through
   its `dispose` hook. Parallel agents are the normal case, not the advanced one.
2. **Focus that follows the work.** The whole tree is always reachable — nothing is permanently
   hidden. Pins and hides are set for the project and inherited by every worktree; an agent
   overrides them for the one worktree whose task needs it. A stable worktree keeps what it
   inherited.
3. **Story layers.** Changes read along the application's own layers — view → RPC → controller →
   service → repository → schema — not alphabetically. The sequence is declared, never inferred,
   and a worktree whose task reads along a different path declares its own.
4. **Canvas.** The agent's free surface: diagrams, tables, flow explanations, comparisons, review
   write-ups. HTML-first, because humans read it faster. Canvas carries the quantitative evidence
   too — coverage, mutation score, complexity, new dead code — not as decoration but as **reading
   triage**: which of today's changes deserve line-by-line attention, and which can be skimmed.
5. **Remote.** Cloudflare Tunnel in front of loopback. Pairing stays. LAN and Tailscale stay
   optional. Two daemons are two tunnels. The Mac app is a viewer of those daemons, not a
   second product.
6. **Tasks.** One cross-project board, quick to add to — especially screenshots — with tags,
   statuses, and descriptions. Agents read it and pick work up. It does not need to chain into
   Canvas or execution to earn its place.

Agents run in a terminal — Porcelain's or any other — and reach Porcelain through the CLI. **Do not
rebuild an in-app agent runner.**

## Supporting surfaces

Real, shipped, and not the moat: repository search, the commit tab, git quick actions and the commit
composer, history, settings, and a bottom terminal strip sized for a dev server.

## Non-goals

- An agent host or in-app agent runner.
- An IDE — no autocomplete, no multi-file refactor, no format-on-save.
- A second architecture, and no Effect rewrite (see `internals/architecture.md`).
- Any surface that exists to fill a panel rather than to serve a pillar.

## Principles

- **Trust over velocity** — review depth beats cockpit breadth.
- **Viewer, not editor** — lightweight always wins.
- **Performance is a feature** — stay fast on a real monorepo, not on a fixture.
- **Companion, not competitor** — integrate with the editor and the agent host; don't replace them.
- **Connected, not siloed** — one home per concern. Previews hand off; never a second diff UX.
- **The agent configures, the human decides** — the agent writes worktree profiles, curates Actions,
  and fills the Canvas. Running things and signing off stay with the human.
- **Local by default** — machine secrets and Project data live on the daemon host under
  `~/.porcelain/`, keyed by a stable Project id (ADR 0002). Opening a repository adds nothing to its
  working tree; only explicitly promoted Canvas and project overrides live in `<repo>/.porcelain/`,
  and a promoted file is then the one canonical copy. Tasks belong to the machine, not a checkout.
- **Your code never reaches us.** No Porcelain cloud for your code, no telemetry. If a relay ever
  ships, it is zero-knowledge — it routes encrypted bytes and cannot read content — because this
  daemon holds work repositories.

## Two modes, and why they differ

Porcelain is **built** on weekends, tired, as a side project: quality there is carried by metrics,
gates, and agent loops rather than by reading the code. Porcelain is **for** weekday work, where
reading the code is the job someone pays for. Both are true. They are different jobs, and only the
second one is the product.

Open this file when designing features, prioritising, or writing public identity copy. Day-to-day
implementation does not need it if root `AGENTS.md` is enough.
