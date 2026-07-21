# Plans

Working docs and shipped records for Porcelain. Prefer skills for durable truth (`product`, `architecture`, `audit`, `marketing`). Plans are for **live decisions** or a **short ship record** — not a second product wiki.

## Live (ground truth from 2026-07-21 strategy pass)

| Doc | Role |
|-----|------|
| [`launch-narrative.md`](launch-narrative.md) | **What to say:** pitches, philosophy story, X/PH, voice, benefits, board vs chat |
| [`positioning-and-roadmap.md`](positioning-and-roadmap.md) | **What we decide:** identity, pillars, competitive stance, non-goals, marketing principles, roadmap status |

Together with the `product` skill, these are the bar for identity. Older plan files do not override them.

## Not here anymore (shipped or superseded)

Removed from the tree after reconcile. Recover from git if you need the full text.

| Former path | Why removed | Recover |
|-------------|-------------|---------|
| `review-canvas.md` | Review is Intent · Execution · Evidence; plan was Overview \| Loop evidence and is fully shipped | `git log -- plans/review-canvas.md` |
| `ui-ux-review-2026-07-20.md` | Waves A–D shipped 2026-07-21; optional P3 polish only | same |
| `design-overhaul.md` | Typography + composition + marketing re-shoot shipped | same |
| `agent-ux-mockups.html` | Planning mockups; Agent/Feature loop is in the product | same |
| Older numbered audits `023`–`037`, remote Phase 4, nova theme, etc. | Long-ago shipped; recorded below or in git | e.g. `git show 0a7e59c:plans/025-unify-persistence-factories.md` |

## Shipped record (summary)

Do not re-open these as live plans.

- **Marketing redo (2026-07-21):** opaque site, trusted-work identity, regenerated shots, launch narrative; product/CLAUDE/README aligned  
- **Review = Intent · Execution · Evidence (2026-07-21):** Feature tab redesign; Excalidraw on Intent only; porcelain-companion skill + references  
- **UI/UX waves A–D (2026-07-20 → 21):** naming, Glance routing, idle Next strip, Session→diff, Review commit handoff, inbox cues, pin language  
- **Worktrees + Review inbox + Glance + evidence checks (2026-07-19)**  
- **The Review document model + chat claims + Linux release leg (2026-07-18)**  
- **Nova preset + light/dark/system theme → v0.32.0**  
- **Remote environments / `porcelain-daemon` npx serve**  
- **Deep audit plans 023–037 (2026-07-05 → 07)**  

## Deferred until requested

- **Read-only PR review** (old plan 036 Part B). Spike: `git show f8ef9ef:plans/spike-pr-review.md`. Not building until a user asks.  
- Optional UI P3 polish (dirty tabs, find-in-diffs, …) — only if it still hurts in daily use.

## Rejected (do not re-audit)

See git history of this file pre-2026-07-21 for the long rejected list (numstat rename, markdown pipeline merge, api.ts router split, etc.). Still stands unless evidence changes.

## Working rules

- Verification gate: `pnpm verify` before commit; commit on `main` only  
- When a plan ships: delete or archive it here in the same pass; update skills, not leave a second source of truth  
- Marketing claims must match the shipped app and the `product` skill  
