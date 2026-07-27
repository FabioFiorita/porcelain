# Positioning & roadmap

**Ground truth for strategy** — identity, pillars, competitive stance, non-goals, marketing principles, roadmap status.  
**Public pitches and philosophy prose:** `plans/launch-narrative.md`  
**Feature inventory and product principles:** `.agents/skills/product/SKILL.md`  
**Session one-liner:** `CLAUDE.md` / `AGENTS.md`

Update when the landscape shifts, a non-goal becomes in-scope, or identity/pillars change. Do not re-open shipped work as “live phases.” When this conflicts with an old plan file, **this file + product skill win**.

---

## Identity (locked)

> **Porcelain is where agent work becomes trusted work.**

One lightweight **review layer** for agentic coding (a macOS app + a daemon-served browser client; the daemon itself runs anywhere Node does). Not an editor. Your agents run in your terminal; Porcelain is where you review what they built as a **story**, not a file list.

**Soul (does not change when features grow):** humans must still understand and trust agent work. The product started as a review companion next to external agents, spent sixteen days trying to be the place agents run too, and came back to what it is best at: **the place judgment lives**. Features stacked faster than the story for a while. The story is now clear: **trust, not velocity.**

**Era (2026-07-27):** the **review layer** for agentic coding. Agents run in a terminal — Porcelain's embedded one or any other — and feed the Review through the porcelain CLI either way. This **reverses** the 2026-07-11 “agents *inside*” era: the in-app agent runner is deleted. It does *not* return to “no terminal in the window”; the embedded terminal stays.

---

## Pillars (priority order — always)

When prioritizing, designing, or writing copy, **this order is non-negotiable**:

1. **Review depth (the moat)**  
   The Review (Intent · Execution · Evidence), flow-ordered diffs, review comments both ways, explore-a-flow, monorepo hide/pin, loop evidence as trust currency.  
   *No competitor we care about owns this side of the pile.*

2. **Remote as a product (second moat)**  
   One token-gated daemon; three clients: local app, app pointed at remote env (per-window), any browser (including mobile). PTYs and review state **daemon-side** (survive reconnect).  
   *Not SSH plumbing theater. Not an “iPad app” — browser access on mobile devices.*

**There is no third pillar.** “Running agents” was one until 2026-07-27. The in-app runner is gone; the embedded terminal is a *supporting surface* under pillar 1, not a pillar. If a proposal only makes sense as “Porcelain runs the agent,” it is off-strategy.

---

## What the product is (ground truths)

Use these when deciding “is this on-brand?”

| Truth | Meaning |
|-------|---------|
| Trust over velocity | More unreviewed agent output is not progress |
| Story over soup | Flow order and the Review document, not alphabetical diffs |
| Viewer, not editor | Quick single-file edits OK; no IDE features (autocomplete, multi-file refactor, format-on-save) |
| Connected homes, not silos | One deep home per concern (Changes / Review / Files / Board / Terminal); preview + handoff elsewhere |
| Local by default | Channels = watched files under `~/.porcelain/` + bundled CLI. No MCP port, no Porcelain cloud for code, no telemetry |
| CLI + porcelain-companion skill | `~/.porcelain/porcelain` + `npx skills add FabioFiorita/porcelain` |
| Agents run in a terminal | Porcelain runs no agent. Whatever CLI the user runs (Claude Code, Codex, OpenCode, Grok, anything) feeds the Review through the porcelain CLI |
| Open source, free | MIT; BYO agent subscriptions |

**The Review (Review tab, ⌘3):** three human questions — Intent (*what / why*), Execution (*what did it touch / is the code right*), Evidence (*did it work*). No automatic baseline: no review set → “No review yet.”

**Remote one-liner:** `npx porcelain-daemon@latest serve --tailnet --print-token` — start when you work, stop when done.

---

## Who it is for

**Primary:** Engineers already serious about coding agents who feel the bottleneck is **reading and trusting**, often monorepos, often a second machine for power.

**Secondary:** Compute on a home server / cloud box; seat is laptop or phone **browser**.

**Not primary:** Non-engineers; Enterprise PR-as-center-of-gravity; “AI so I never look.”

---

## Competitive stance

Most peers are **“run many agents” cockpits**. Our wedge is the other side: **can you trust what came out?** We are deliberately not on their axis at all — Porcelain does not spawn, steer, or count agents, so “how many providers / how much orchestration” is a comparison we decline rather than lose.

- Do not copy their voice (breadth, velocity, glass dashboards).  
- Do not benchmark adoption against a creator with a distribution machine. Benchmark **retention of reviewers**.  
- We are **complementary to a cockpit, not a smaller one**: whatever spawns the agent, the diff still has to be read. Say that when compared.  
- Landscape snapshot last written 2026-07-19 (T3 Code, Synara, etc.) — **re-check before a big launch.**

| | Cockpits | Porcelain |
|--|----------|-----------|
| Center | Spawn & steer | Understand & trust |
| Agents | Runs them, counts them | Runs none; they run in your terminal |
| Review | Diff / PR-shaped | Story + whole feature + evidence |
| Remote | Plumbing / later | Product (daemon + three clients) |
| Channel | Chat / MCP | Local CLI + skills |

---

## Non-goals (hard)

- **An in-app agent runner** (removed 2026-07-27 — agent threads, provider drivers, Settings → Agents). Agents run in a terminal  
- **An agent-to-agent chat relay** (removed 2026-07-27 — messages, file claims, overlap detection). Coordinating parallel agents is not our problem to solve  
- Provider breadth race / cross-provider hand-off as a flagship  
- Scheduled automations / built-in browser as core  
- **A packaged Linux desktop app** (removed 2026-07-27 — AppImage + deb targets, the `package-linux` release job). Never used by the maintainer, and its packaging job gated the Mac release we actually ship. Linux stays first-class as a **daemon host** (npm `porcelain-daemon`) with the browser as its seat  
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

1. **Identity first** — trusted work / review layer; hero = the Review, not a toolkit grid.  
2. **One idea per section** — do not restack “trust / complete surface / pillars manifesto” after the hero already said it.  
3. **The board is its own highlight** with its own screenshot — it is the planning surface, not a second view of review comments.  
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
| Remove the in-app agent runner, the chat/relay feature, and the packaged Linux desktop app; re-anchor on the review layer | **Shipped** 2026-07-27 |
| Environments v2 (identity + status, switcher chip, pairing, per-device credentials, multi-endpoint failover) | **Shipped** 2026-07-27 |
| Marketing + identity refresh (site, shots, README, launch narrative, skills align) | **Shipped** 2026-07-21 |
| Review inbox (cross-worktree review signals) | **Shipped** 2026-07-19 |
| Glance, touch polish, structured evidence checks | **Shipped** 2026-07-19 |
| Review canvas → Intent / Execution / Evidence | **Shipped** 2026-07-21 |
| UI/UX waves A–D (naming, handoffs, inbox, pin language) | **Shipped** 2026-07-21 |
| plans/ prune (shipped planning docs removed) | **Shipped** 2026-07-21 |

### Still open (only if it still hurts)

- Optional P3 UI polish (find-in-diffs, dirty tab indicator, …) — demand-gated  
- Darwin native visual baseline regen when macOS CI needs it  
- First-run empty states teaching the wedge end-to-end (welcome / Changes)  

### Demand-gated backlog

PR create + PR review, Windows daemon/app. (Provider support is not a backlog item — Porcelain runs no agent.)

---

## Traps

- Competitors ship near-daily and *look* like momentum; our gap is **legible releases**, not raw cadence  
- Do not reintroduce glass, MCP positioning, provider treadmills, an in-app agent runner, an agent chat relay, or a packaged Linux desktop app (the daemon + browser are the Linux seat)  
- “Review layer” is not “viewer companion only”: the embedded terminal, board, comments, and actions stay  
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
