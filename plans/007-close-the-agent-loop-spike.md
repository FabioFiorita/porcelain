# Plan 007: Design spike — close the agent loop (review feedback flows back to the agent)

> **Executor instructions**: This is a **pure design spike**. Your deliverable is a
> written design memo — **you will not modify any source code**. The thing being
> designed crosses a deliberately-guarded boundary (the MCP agent channel; see "Current
> state"), so committing to an implementation without the maintainer's sign-off would
> violate this repo's hard rule 1 (never introduce a new pattern — here, an app→agent
> data flow — without approval) and the `audit` skill's channel invariant. Investigate
> by reading the cited files, then write the memo. When done, update this plan's status
> row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- src/mcp src/main/review-set.ts src/main/review-store.ts`
> If any of those changed since this plan was written, re-read them live before writing
> the memo (the channel shape is the whole subject).

## Status

- **Priority**: P1
- **Effort**: M (investigation + memo; no code)
- **Risk**: LOW (no code changes) — but the *thing designed* is MED/HIGH risk, which is
  exactly why it's a spike first.
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

Porcelain is a **review** tool whose stated identity (CLAUDE.md, the `product` skill)
is a "viewer **and agent companion**." But the agent integration is **one-directional**:
the agent pushes a feature review set *into* the app over MCP, and the app's role ends
at *displaying* it. When a human reads the agent's work in Porcelain and finds something
wrong, there is **no in-app path to send that back** — they retype it into the terminal.
And there are **zero review annotations anywhere** in the app: the Notes card is
freeform per-repo scratch, not anchored to a file or line.

The project's decision log (`history` skill) has carried *"Agent-session integration
design (beyond a plain terminal)"* as the **single open strategic decision** for the
whole project. This spike scopes that decision concretely and on-brand: let the human
attach review comments in the diff/feature surfaces, and let the agent read them back —
turning Porcelain from a one-way viewer into a true review loop. The payoff is the
differentiator that makes "agent companion" real: review in Porcelain → agent fixes →
re-pushes → review again.

This is a spike and not a build plan because the data model, the storage location, and
the channel direction are all genuinely open, and one of the options reverses a
load-bearing safety invariant — those are the maintainer's calls.

## Current state

The agent channel today, end to end (read all of these before writing the memo):

- `src/mcp/protocol.ts` (lines ~31–70) — the MCP tools the agent can call. **All four
  are agent→app**: `set_feature_review`, `add_review_files`, `clear_feature_review`,
  `get_feature_review`. `SERVER_INFO` is version `0.3.0`. There is no tool that returns
  *human* feedback to the agent.
- `src/mcp/server.ts` — the stdio dispatcher: `callTool(name, args)` routes each tool to
  `review-file.ts`. Note the comment: *"stdio only — no network port, so it adds no
  inbound surface to the app."* Lines are processed strictly in order because tool calls
  mutate one shared file.
- `src/mcp/review-file.ts` — the channel's storage. Dependency-free (Node builtins
  only). Reads/writes `~/.porcelain/review-sets.json` (override `PORCELAIN_REVIEW_SETS`).
  Atomic tmp+rename writes. The data model:
  ```ts
  export interface ReviewFile { path: string; source?: string; note?: string }
  export interface ReviewSet  { name: string; files: ReviewFile[] }
  ```
  The `note` field is **the agent's** invariant for the human to check — there is no
  field for the human's comment back.
- `src/main/review-set.ts` — the app-side zod schema for the same file
  (`reviewSetFileSchema` / `reviewSetSchema` / `reviewSetsSchema`), re-validated on every
  read because an external process owns the file.
- `src/main/review-store.ts` / `src/main/review-watch.ts` — the app **reads and watches**
  that file and pushes a `feature-view` app-event on change. The app makes **exactly one
  write**: `clearReviewSet` (the Feature tab's Clear button).
- `src/renderer/src/components/git/feature-list.tsx` — where the human reads the feature
  (the sidebar list) and `feature-view.tsx` (the inline reading surface). These are the
  natural anchor points for a "leave a comment on this file/line" affordance.

**The guarded invariant you must design around** — from the `audit` skill, quoted
verbatim because the executor has not read it:

> **The MCP agent channel adds NO inbound network surface.** … The MCP server
> **authors** the sets; the app makes exactly ONE write — `clearReviewSet` … Don't add
> other app-side writes to this file, and don't "upgrade" the channel to an in-app
> HTTP/MCP listener — that's the inbound surface this design deliberately avoids. The
> server stays **dependency-free** (Node builtins only) … keep tool inputs validated in
> `toReviewFiles`.

So: a naive "the app writes the human's comments into `review-sets.json`" would add a
second app-side write to a file the audit invariant says the app must not author into,
and "the app exposes the comments over a port the agent polls" is exactly the inbound
listener the whole design avoids. The memo must navigate this — likely with a
**separate** human-authored file that the *MCP server* reads (preserving "the app writes
its own channel, the server reads it; no network port, no app write into the agent's
file").

## Commands you will need

None for the deliverable (no code). To investigate, read the files cited above. To
confirm the channel has no network surface (so your design preserves it):

| Purpose | Command | Expected |
|---|---|---|
| Confirm no listener | `rg -n "createServer\|listen\(\|http" src/main src/mcp` | nothing (the invariant) |

## Scope

**In scope** (the only file you create/modify):
- `plans/007-close-the-agent-loop.notes.md` — **create**; the design memo.
- `plans/README.md` — update this plan's status row at the end.

**Out of scope** (do NOT modify — this is a design spike):
- Everything under `src/`. No code. If the design feels obvious enough to "just build,"
  that is the trap this spike exists to avoid — the channel direction is a safety
  decision (audit invariant) that needs the maintainer.

## Steps

### Step 1: Investigate and write the design memo

Create `plans/007-close-the-agent-loop.notes.md` answering each section below with a
recommendation **and** its trade-off, grounded in the files above.

The memo MUST contain these sections:

1. **The asymmetry, precisely** — one paragraph restating the gap with file pointers
   (agent→app only; `note` is the agent's, not the human's; no annotation model exists).
2. **Annotation data model** — what a human review comment is:
   - Granularity: per-file vs. per-line/per-hunk vs. both. (Per-file is trivial to
     anchor and survives edits; per-line is more useful but anchoring drifts when the
     file changes — state how you'd anchor: line number? a content snippet? file+symbol?)
   - Fields: `path`, optional `line`/`range`, `body`, a `resolved` flag, timestamp.
   - Standalone value: these annotations are useful **even with no agent connected** (a
     human reviewing for themselves, leaving anchored notes). Design them to work without
     MCP first; the agent read-back is the second layer.
3. **Storage + channel direction — the crux, navigate the audit invariant**:
   - Recommend WHERE comments live. Quote the audit invariant (above) and show your
     option does not break it. The likely-correct shape: comments persist in a
     **separate, app-owned file** (e.g. `~/.porcelain/review-comments.json`, or the
     existing per-repo app config under `repo-config.ts`), and the **MCP server gains a
     read-only `get_review_comments` tool** that reads *that* file — so the app writes
     its own file (allowed), the server reads it (allowed), and no network port or app
     write into the agent's `review-sets.json` is introduced. Contrast this against the
     two rejected shapes (app writes into `review-sets.json`; app opens a listener) and
     explain why yours preserves the invariant.
   - If you recommend the app-config route instead of a new home-dir file, note that the
     MCP server is dependency-free and runs outside Electron, so it **cannot read
     Electron's userData** — the same constraint that put review sets in `~/.porcelain`
     (this is documented in the feature-view history). A home-dir file is probably right
     for the same reason.
4. **MCP surface** — the new tool(s): name, input (`repoPath`, maybe `resolved`-filter),
   output shape (the comments as JSON, mirroring how `get_feature_review` /
   `describeReview` returns a summary + JSON in `review-file.ts`). Bump `SERVER_INFO`
   version. Note this is **read-only from the agent's side** — the agent pulls feedback,
   it does not write it; symmetrical to how the human pulls the agent's set.
5. **UI surface** — where the human leaves a comment: a per-file affordance on
   `feature-list.tsx` rows and/or an inline gutter action on the reading surface
   (`feature-view.tsx` / `reading-surface.tsx`) and the diff (`hunks-view.tsx`). Keep it
   shadcn-primitive-only (hard rule 5). Recommend the smallest first cut (probably
   per-file comments on the Feature list, since rows already exist — see how the `note`
   flag renders a `Flag` callout in `feature-list.tsx` lines 88–93; human comments could
   render the same way, differently tinted).
6. **Skill/agent guidance** — the bundled `review-with-porcelain` skill (in
   `plugin-assets.ts` as `REVIEW_SKILL`) teaches the agent the push side; it would need
   a line teaching the agent to **pull review comments** after the human reviews. Note
   this; don't write it.
7. **Phasing** — recommend a build order: (phase 1) app-owned per-file annotations with
   local persistence + UI, no MCP — proves the annotation model with zero channel risk;
   (phase 2) the `get_review_comments` MCP tool + skill guidance — closes the loop.
   Each phase is its own future build plan.
8. **Open questions for the maintainer** — every decision needing a human: granularity,
   storage location, whether annotations are agent-only or also a solo-review feature,
   line-anchoring strategy, whether `resolved` state syncs back.

**Verify**: `grep -c '^## ' plans/007-close-the-agent-loop.notes.md` → at least 8.

### Step 2: Update the index

Update this plan's row in `plans/README.md` to DONE (note: "design memo landed; channel
direction + annotation model decisions pending maintainer").

## Done criteria

ALL must hold:

- [ ] `plans/007-close-the-agent-loop.notes.md` exists with all eight required sections.
- [ ] The memo's storage recommendation explicitly addresses the audit channel invariant
      (quotes it and shows the design preserves "no network surface, app doesn't author
      the agent's file").
- [ ] **No files under `src/` were modified** (`git status` shows only the two plans
      files changed).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The MCP channel files (`src/mcp/*`, `review-set.ts`, `review-store.ts`) have drifted
  materially from the "Current state" description — the memo would be designing against a
  stale channel.
- You conclude the only viable design *requires* breaking the audit invariant (an app
  write into `review-sets.json`, or a listener) — that is a real finding; report it as
  the headline rather than quietly recommending an invariant break.
- You feel the task can't be done without writing code to "prove" it — it can; the memo
  is the deliverable, and the prototype belongs to a later build plan after the
  maintainer picks the channel direction.

## Maintenance notes

- This is the concrete scoping of the project's long-open "agent-session integration"
  decision. The memo is meant to be read by the maintainer and turned into one or two
  build plans (phase 1 annotations, phase 2 MCP read-back).
- The single highest-stakes line in the whole design is the channel direction — the
  whole MCP architecture was built to avoid an inbound network surface, so the
  app-owns-a-file / server-reads-it shape is almost certainly the only one consistent
  with the existing invariants. Flag any deviation loudly.
- Related: this loop is most valuable *after* branch/base review (plan 006) exists, since
  the natural review target is a committed branch, not just the working tree.
