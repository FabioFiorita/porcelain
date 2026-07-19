# Positioning & roadmap — live doc

Written 2026-07-19 from a competitive read of **T3 Code** (pingdotgg) and
**Synara** (Emanuele Di Pietro). This is the identity + roadmap record: what
Porcelain is *for* in this market, what we deliberately don't chase, and the
order of work. Update it when a phase ships or the landscape shifts; fold into
README when it stops being live.

## The landscape (snapshot, 2026-07-19)

Both competitors are **"run many agents" cockpits**. Neither owns review.

- **T3 Code** — MIT, ~14.2k stars, ~60k users (Theo's claim), v0.0.x. Local
  Node daemon + React client, Electron shells for mac/win/linux + `npx t3`.
  Codex-first adapters (Claude Code, Cursor, OpenCode; Gemini planned).
  Flagship: **multi-repo parallel agents in isolated git worktrees**, one-click
  commit→push→PR with PR-status icons. Remote = SSH port-forward plumbing
  (desktop probes a host, starts a remote server, forwards a port); React
  Native mobile app in development. Review surface is a plain diff viewer —
  richer review comments + an MCP review server are *proposed* (their issue
  #345), not built. Its real moat is **Theo's distribution**, not the software.
- **Synara** — MIT, ~1.3k stars, solo dev, v0.5.x shipping near-daily.
  Electron, mac/win/linux, SQLite local-first, BYO-subscription pitch ("the
  best place to build with your AI sub"). Breadth is the wedge: **9+ providers**
  (Claude Code, Codex, OpenCode, Cursor, Antigravity, Grok, Kilo, Pi, Factory
  Droid) with **cross-provider hand-offs preserving context** (their signature
  feature), worktrees, one-click PRs, scheduled automations, built-in browser.
  No remote/mobile story at all; review is diff/PR-shaped, nothing deeper.

What neither has (verified 2026-07-19): flow-ordered review, any agent-authored
review artifact, review comments that round-trip to the agent, loop evidence,
monorepo scoping (hide/pin), a first-class remote daemon (PTYs + state
daemon-side, browser client on any device), or agent channels beyond chat
(board, actions, claims).

## Identity

The market's bottleneck is shifting from *generating* agent work to
**trusting** it. Everyone is racing to spawn more agents in more worktrees;
the pile of unreviewed diffs grows on the other side. Porcelain stands on that
side:

> **Porcelain is where agent work becomes trusted work.** Run your agents
> anywhere — Mac, home server, browser, iPad — and review what they built the
> way a senior engineer reads a feature: as a story, not a file list.

Three pillars, in priority order:

1. **Review depth** (the moat): flow-ordered diffs, the Review (agent-authored
   walkthrough with thesis/sections/loop evidence), review comments both ways,
   explore-a-flow comprehension, monorepo scoping. No competitor has any of it.
2. **Remote as a product** (the second moat): one token-gated daemon, three
   clients (Mac app local, Mac app remote, any browser), state daemon-side.
   T3's SSH forwarding and in-progress mobile app validate the demand; we're
   ahead — say so.
3. **Running agents** (table stakes, kept deliberately narrow): 3 providers
   done well, threads, permissions, favorites. We do NOT compete on provider
   count or automation breadth.

Design identity to match: **the reading room**. Calm, typography-first,
document-shaped review surfaces (the Review, zen mode, opaque quiet chrome with
the one sanctioned nova translucency). T3 sells "minimal control plane",
Synara sells "clean and fast"; we sell *legible*. Every new surface should ask
"does this read like a document?" before "does this look like a dashboard?".

## Non-goals (so we don't lose the identity)

- **Provider breadth race.** Synara's 9-provider treadmill is a solo-dev
  reliability trap and off-identity. Add a provider only on real user demand.
- **Cross-provider hand-offs.** Signature Synara feature; orthogonal to review.
- **Scheduled automations / built-in browser.** Cockpit features, not review.
- **Windows.** The browser viewer already covers other OSes as clients; a
  Windows daemon/app waits for demand.
- **Becoming an editor.** Unchanged; still the line we don't cross.
- **PR review** stays demand-gated (spike is GO, `git show f8ef9ef:plans/spike-pr-review.md`).

## Roadmap

### Phase 1 — sharpen the wedge (now)
Make the Review impossible to miss; it's invisible from a repo README today.
- Marketing/README refresh around the identity statement: hero = the Review +
  flow-ordered diff, GIF/video of an agent publishing a review and the human
  reading it J/K/zen. (The stale-marketing item rejected in the audit as
  "low value" is now load-bearing — competitors win on story, not software.)
- In-app: first-run empty states should *teach* the wedge (the Feature tab's
  copyable prompt already does this — audit the welcome screen and Changes tab
  for the same standard).

### Phase 2 — close the one table-stakes gap (SHIPPED 2026-07-19)
**Worktree-per-agent-thread.** The single feature both competitors are winning
with, and it *feeds* our wedge: more parallel agents ⇒ more review demand.
Shipped: Agent tab "+" → "New thread in worktree…" (new branch off HEAD,
sibling `<repo>-worktrees/<branch>` checkout), the thread bound to the
worktree path (binding chip in roster + session strip), the window switching
there so Changes scope automatically. Durable decisions in the `architecture`
skill. Explicitly NOT built: auto-PR pipelines.
- Follow-on (SHIPPED 2026-07-19): one-click push — the commit composer shows a
  push row when unpushed commits exist (`-u origin HEAD` on the fresh-worktree
  first push, plain `push` once an upstream exists). PR creation still
  demand-gated — see non-goals.

### Phase 3 — deepen the moats (SHIPPED 2026-07-19)
- **Review inbox** (SHIPPED): the Feature tab lists every other worktree with
  agent work awaiting review (changed files, bound threads, pushed Review) —
  one click switches there. `worktree-inbox.ts` / `review-inbox.tsx`; the
  cross-worktree surface T3's issue #345 wishes it had.
- Remote polish for touch/iPad (SHIPPED): touch polish (split-view entry points
  hidden on phones, hover-revealed row actions always shown on touch) plus **the
  Glance** — a phone-only companion home (threads in flight, Review inbox,
  checkout signal, board) an empty viewer pane renders below 768px. Beat T3's
  mobile app to *usable* with zero app store.
- Loop-evidence growth (SHIPPED): structured verification checks — the `evidence
  check` CLI verb writes bounded pass/fail/skip checks into the evidence meta,
  overall status is DERIVED, and the Review's evidence chapter renders them
  natively as a check list + status badge; read-side headroom raised to 4 MB for
  screenshots. Evidence is the trust currency.

### Demand-gated backlog
More providers (Gemini/Cursor), PR create + PR review, Windows.

## Traps

- **Velocity optics**: both competitors release near-daily and it *reads* as
  momentum. Our cadence is fine; our *changelog visibility* is not — make
  releases legible (notes, images) even when the pace is weekly.
- Synara rebranded from "DP Code" and may have a token/crypto element
  (bankr.bot page, unverified) — don't copy positioning from them blindly.
- T3's numbers are audience-driven; do not benchmark adoption against a
  creator with a YouTube channel. Benchmark against *retention of reviewers*.
