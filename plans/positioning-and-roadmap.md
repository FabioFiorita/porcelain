# Positioning & roadmap

Identity, competitive stance, non-goals, and demand-gated backlog.  
**Product features and pillars (durable):** `.agents/skills/product/SKILL.md`  
**Public pitches (X, Product Hunt):** `plans/launch-narrative.md`

Update this file when the competitive landscape shifts or a non-goal becomes in-scope. Do not re-list shipped phases as open work.

## Identity

> **Porcelain is where agent work becomes trusted work.** Run your agents
> anywhere (Mac, Linux, home server, browser on desktop or mobile) and review
> what they built the way a senior engineer reads a feature: as a story, not a
> file list.

### Pillars (priority order)

1. **Review depth** (moat): the Review (Intent · Execution · Evidence), flow-ordered diffs, comments both ways, explore-a-flow, monorepo hide/pin.
2. **Remote as a product** (second moat): one token-gated daemon; local app, remote environment, or any browser. State and PTYs daemon-side.
3. **Running agents** (table stakes, keep narrow): Claude Code, Codex, OpenCode, Grok through the user's installed CLIs. No provider-count race.

### Design language (internal)

Calm, opaque, typography-first chrome. Sans for UI/prose; mono for code. Sell *legible* and *trusted*, not glass or velocity hype. Do not put internal design nicknames on the marketing site.

## Landscape (snapshot 2026-07-19; re-check before a launch)

Competitors (T3 Code, Synara, etc.) are mostly **"run many agents" cockpits**. Neither owned review depth, agent-authored Review documents, two-way comments, loop evidence, monorepo hide/pin, or a first-class remote daemon with browser clients when this was written.

Do not benchmark stars against creator distribution. Benchmark **retention of people who review**.

## Non-goals

- Provider breadth race / cross-provider hand-off theater  
- Scheduled automations / built-in browser as core  
- Windows-native app first (browser covers clients)  
- Becoming an editor  
- PR create / PR review until real demand (spike: `git show f8ef9ef:plans/spike-pr-review.md`)

## Roadmap status

| Phase | Status |
|-------|--------|
| Marketing + identity refresh (README, site, shots, launch narrative) | **Shipped** 2026-07-21 |
| Worktree-per-agent-thread + push row + Review inbox | **Shipped** 2026-07-19 |
| Glance / touch polish / evidence checks | **Shipped** 2026-07-19 |
| Review canvas → Intent / Execution / Evidence | **Shipped** 2026-07-21 |
| UI/UX waves A–D (naming, handoffs, inbox cues) | **Shipped** 2026-07-21 |

### Still open (only if it still hurts)

- Optional P3 polish from the old UI/UX list (find-in-diffs, dirty tab indicator, etc.) — demand-gated, not a live plan doc  
- Darwin native visual baseline regen when macOS CI needs it  
- In-app empty states teaching the wedge end-to-end (welcome / Changes) — product skill + first-run copy, not a separate roadmap phase  

### Demand-gated backlog

More providers (Gemini/Cursor), PR create + PR review, Windows daemon/app.

## Traps

- Competitors ship near-daily and *look* like momentum; our gap is **legible releases**, not raw cadence  
- Do not reintroduce glass, provider treadmills, or MCP-as-channel positioning  
