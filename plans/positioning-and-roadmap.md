# Positioning & roadmap

**Ground truth for strategy** — identity, pillars, competitive stance, non-goals, marketing principles, roadmap status.  
**Public pitches and philosophy prose:** `plans/launch-narrative.md`  
**Feature inventory and product principles:** `.agents/skills/product/SKILL.md`  
**Session one-liner:** `CLAUDE.md` / `AGENTS.md`

Update when the landscape shifts, a non-goal becomes in-scope, or identity/pillars change. Do not re-open shipped work as “live phases.” When this conflicts with an old plan file, **this file + product skill win**.

---

## Identity (locked)

> **Porcelain is where agent work becomes trusted work.**

One lightweight hub for agentic coding (macOS + Linux apps + daemon-served browser). Not an editor. Run coding agents **and** review what they built as a **story**, not a file list.

**Soul (does not change when features grow):** humans must still understand and trust agent work. The product started as a review companion next to external agents; it became the place agents run *and* the place judgment lives. Features stacked faster than the story for a while. The story is now clear: **trust, not velocity.**

**Era:** hub for agentic coding (agents *inside*). Retired: “viewer + companion only; agents live only in an external terminal.”

---

## Pillars (priority order — always)

When prioritizing, designing, or writing copy, **this order is non-negotiable**:

1. **Review depth (the moat)**  
   The Review (Intent · Execution · Evidence), flow-ordered diffs, review comments both ways, explore-a-flow, monorepo hide/pin, loop evidence as trust currency.  
   *No competitor we care about owns this side of the pile.*

2. **Remote as a product (second moat)**  
   One token-gated daemon; three clients: local app, app pointed at remote env (per-window), any browser (including mobile). PTYs and review state **daemon-side** (survive reconnect).  
   *Not SSH plumbing theater. Not an “iPad app” — browser access on mobile devices.*

3. **Running agents (table stakes, keep narrow)**  
   Claude Code, Codex, OpenCode, Grok via the user’s installed CLIs. Threads, permission modes, worktrees, Review inbox.  
   *Do not race on provider count or automation breadth. Running agents feeds the review wedge; it is not the brand.*

---

## What the product is (ground truths)

Use these when deciding “is this on-brand?”

| Truth | Meaning |
|-------|---------|
| Trust over velocity | More unreviewed agent output is not progress |
| Story over soup | Flow order and the Review document, not alphabetical diffs |
| Viewer, not editor | Quick single-file edits OK; no IDE features (autocomplete, multi-file refactor, format-on-save) |
| Connected homes, not silos | One deep home per concern (Changes / Feature / Agent / Terminal); preview + handoff elsewhere |
| Local by default | Channels = watched files under `~/.porcelain/` + bundled CLI. No MCP port, no Porcelain cloud for code, no telemetry |
| CLI + porcelain-companion skill | `~/.porcelain/porcelain` + `npx skills add FabioFiorita/porcelain` |
| Four providers today | Claude Code, Codex, OpenCode, Grok |
| Board ≠ agent chat | Board = plan/queue; Chat/Relay = multi-agent messages + file claims + overlaps |
| Open source, free | MIT; BYO agent subscriptions |

**The Review (Feature tab):** three human questions — Intent (*what / why*), Execution (*what did it touch / is the code right*), Evidence (*did it work*). No automatic baseline: no review set → “No review yet.”

**Remote one-liner:** `npx porcelain-daemon@latest serve --tailnet --print-token` — start when you work, stop when done.

---

## Who it is for

**Primary:** Engineers already serious about coding agents who feel the bottleneck is **reading and trusting**, often monorepos, often a second machine for power.

**Secondary:** Compute on a home server / cloud box; seat is laptop or phone **browser**.

**Not primary:** Non-engineers; Enterprise PR-as-center-of-gravity; “AI so I never look.”

---

## Competitive stance

Most peers are **“run many agents” cockpits**. Our wedge is the other side: **can you trust what came out?**

- Do not copy their voice (breadth, velocity, glass dashboards).  
- Do not benchmark adoption against a creator with a distribution machine. Benchmark **retention of reviewers**.  
- Landscape snapshot last written 2026-07-19 (T3 Code, Synara, etc.) — **re-check before a big launch.**

| | Cockpits | Porcelain |
|--|----------|-----------|
| Center | Spawn & steer | Understand & trust |
| Review | Diff / PR-shaped | Story + whole feature + evidence |
| Remote | Plumbing / later | Product (daemon + three clients) |
| Channel | Chat / MCP | Local CLI + skills |

---

## Non-goals (hard)

- Provider breadth race / cross-provider hand-off as a flagship  
- Scheduled automations / built-in browser as core  
- Windows-native app first (browser covers clients)  
- Becoming an editor  
- PR create / PR review until real user demand (spike still in git: `git show f8ef9ef:plans/spike-pr-review.md`)  
- Marketing as a feature dump or repeated thesis on one page  
- Glass / vibrancy identity (opaque serious UI is the ship)  
- MCP as the agent channel (CLI only)  
- Personal setup in user-visible copy (hostnames, private repos, etc.)

---

## Marketing principles (ground truth)

From the 2026-07-21 marketing pass — **do not regress**:

1. **Identity first** — trusted work / hub; hero = the Review, not a toolkit grid.  
2. **One idea per section** — do not restack “trust / complete surface / pillars manifesto” after the hero already said it.  
3. **Board and agent chat are separate highlights** with correct screenshots.  
4. **Remote earns a real section**, not only install step 3.  
5. **Opaque site** matching the app (solid cards, no glass wallpaper).  
6. **Voice:** no hype; no em dashes as asides; no update framing on the site; no “iPad app”; no public “design identity / reading room” block.  
7. **Screenshots** via `pnpm shots` against current UI; og:image = strongest Review shot.  
8. **Version string** on the site must track releases.  
9. Launch posts may use journey language once; the **site** sells the product timelessly.

Full pitch kit: `plans/launch-narrative.md`. Process: `.agents/skills/marketing/SKILL.md`.

---

## Design language (internal only)

Calm, opaque, typography-first. Sans (Geist) for UI + prose; mono for code-like content. Sell *legible* and *trusted*.  

**Do not** put internal nicknames or a “design identity” manifesto on the marketing site. Optional personal metaphor in a single social post is fine; it is not product chrome.

---

## Roadmap status

| Work | Status |
|------|--------|
| Marketing + identity refresh (site, shots, README, launch narrative, skills align) | **Shipped** 2026-07-21 |
| Worktree-per-agent-thread, push row, Review inbox | **Shipped** 2026-07-19 |
| Glance, touch polish, structured evidence checks | **Shipped** 2026-07-19 |
| Review canvas → Intent / Execution / Evidence | **Shipped** 2026-07-21 |
| UI/UX waves A–D (naming, handoffs, inbox, pin language) | **Shipped** 2026-07-21 |
| plans/ prune (shipped planning docs removed) | **Shipped** 2026-07-21 |

### Still open (only if it still hurts)

- Optional P3 UI polish (find-in-diffs, dirty tab indicator, …) — demand-gated  
- Darwin native visual baseline regen when macOS CI needs it  
- First-run empty states teaching the wedge end-to-end (welcome / Changes)  

### Demand-gated backlog

More providers (e.g. Gemini/Cursor), PR create + PR review, Windows daemon/app.

---

## Traps

- Competitors ship near-daily and *look* like momentum; our gap is **legible releases**, not raw cadence  
- Do not reintroduce glass, MCP positioning, provider treadmills, or “viewer companion only”  
- Do not leave finished plans in `plans/` labeled live — delete or archive in the same pass  
- Solo maintainer: commit on `main` after `pnpm verify`; push is deliberate  

---

## Doc map

| Need | Where |
|------|--------|
| What to *say* publicly | `launch-narrative.md` |
| What we *are* / won’t do / status | **this file** |
| What the app *has* (features) | `product` skill |
| How to ship the site / shots | `marketing` skill |
| How the code is structured | `architecture` skill |
