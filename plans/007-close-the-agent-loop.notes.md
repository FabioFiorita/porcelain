# Design memo — Close the agent loop (review feedback flows back to the agent)

> Companion to **plan 007**. This is a pure design spike — **no code was written.**
> The deliverable is this memo. It scopes the project's single long-open strategic
> decision ("agent-session integration") and navigates the one constraint that
> dominates the design: the MCP channel's *no-inbound-surface* invariant.

## 1. The asymmetry, precisely

The agent channel is **one-directional, agent→app**. The four MCP tools
(`set_feature_review`, `add_review_files`, `clear_feature_review`,
`get_feature_review`; `src/mcp/protocol.ts`, `SERVER_INFO` v`0.3.0`) all push or
read the agent's own review set. The data model
(`ReviewFile { path; source?; note? }`, `src/mcp/review-file.ts:13`) carries a
`note` field, but that note is **the agent's** invariant for the human to check —
there is no field for the human's comment going the other way. The app reads and
watches `~/.porcelain/review-sets.json` (`review-store.ts` / `review-watch.ts`) and
makes **exactly one write**: `clearReviewSet` (the Feature tab's Clear button). So
when a human reviews the agent's work in Porcelain and finds something wrong, there
is **no in-app path back** — they retype it into the terminal. And there are **zero
anchored annotations** anywhere: the Notes card is freeform per-repo scratch, not
tied to a file or line.

## 2. Annotation data model

A human review comment is, minimally:

```ts
interface ReviewComment {
  path: string            // repo-relative, like ReviewFile.path
  line?: number           // optional anchor; omit for a file-level comment
  body: string
  resolved?: boolean
  createdAt: string       // ISO timestamp
}
```

**Granularity.** Recommendation: **ship per-file first, design the schema to allow
per-line.** Per-file anchors trivially and survives edits (the path is stable);
per-line is more useful but the anchor drifts the moment the file changes after the
comment is left. Make `line` optional from day one so per-line is an additive
upgrade, not a migration. For per-line anchoring later, prefer **a content snippet
+ a hint line** over a bare line number (a bare number silently mis-points after any
edit above it) — but that's a phase-2 refinement, not the first cut.

**Standalone value.** These annotations are useful **with no agent connected at
all** — a human reviewing for themselves, leaving anchored notes that persist across
tab switches (today impossible; Notes is unanchored scratch). Design them to work
without MCP *first*; the agent read-back is a second, optional layer. This de-risks
the whole feature: phase 1 ships value even if the loop is never closed.

## 3. Storage + channel direction — the crux

The guarded invariant (`audit` skill), verbatim:

> **The MCP agent channel adds NO inbound network surface.** … The MCP server
> **authors** the sets; the app makes exactly ONE write — `clearReviewSet` … Don't
> add other app-side writes to this file, and don't "upgrade" the channel to an
> in-app HTTP/MCP listener — that's the inbound surface this design deliberately
> avoids.

Two naive designs **break** it and must be rejected:

- **App writes the human's comments into `review-sets.json`** → a second app-side
  write into the file the agent authors. Rejected.
- **App opens a port the agent polls** → exactly the inbound network listener the
  architecture exists to avoid (confirmed still absent:
  `rg "createServer|listen\(|http" src/main src/mcp` finds nothing). Rejected.

**Recommended shape — a separate, app-owned file the server reads.** Human comments
persist in their own file, e.g. `~/.porcelain/review-comments.json` (same
`~/.porcelain` home, same `PORCELAIN_*` override convention as
`review-file.ts:30`). The **app writes its own file** (allowed — it's not the
agent's file), and the **MCP server gains a read-only tool** that reads *that* file.
No network port; no app write into `review-sets.json`. This preserves every clause
of the invariant: the app authors its channel, the server reads it, symmetric to how
the human reads the agent's set today.

**Why a home-dir file and not Electron `userData`/`repo-config.ts`:** the MCP server
is **dependency-free and runs outside Electron** (a plain `node` process), so it
*cannot* read Electron's `userData` — the exact constraint that put review sets in
`~/.porcelain` in the first place. A home-dir JSON file (atomic tmp+rename writes,
mirroring `review-store.ts:66`) is almost certainly the only shape consistent with
the existing architecture. Keep the server dependency-free (Node builtins only) and
keep its input validation in the `toReviewFiles` style.

## 4. MCP surface

Add one **read-only** tool (agent pulls feedback; it never writes it — symmetric to
the human pulling the agent's set):

- `get_review_comments` — input `{ repoPath: string; resolved?: boolean }` (the
  filter lets the agent fetch only open comments); output a human-readable summary
  **plus** the comments as JSON, mirroring how `get_feature_review` →
  `describeReview` returns summary+JSON in `review-file.ts`.
- Bump `SERVER_INFO.version` (`0.3.0` → `0.4.0`) since the tool surface grows.

The tool reads `~/.porcelain/review-comments.json` directly (dependency-free), keyed
by `repoPath` like the review sets are.

## 5. UI surface

Where the human leaves a comment — shadcn primitives only (hard rule 5):

- **Smallest first cut: per-file comments on the Feature list** (`feature-list.tsx`).
  The rows already exist and already render `file.note` as a `Flag` callout
  (`feature-list.tsx:88`); a human comment can render the **same way, differently
  tinted** (e.g. a distinct icon/color), so the visual language is already there.
- **Later: inline gutter actions** on the reading surface (`feature-view.tsx`) and
  the diff (`hunks-view.tsx`) for per-line comments.

Keep phase 1 to the per-file affordance on the Feature list — lowest new surface,
reuses an existing row pattern.

## 6. Skill / agent guidance

The bundled `review-with-porcelain` skill (shipped as `REVIEW_SKILL` in
`plugin-assets.ts`) teaches the agent the **push** side only. Closing the loop needs
one added instruction: after the human reviews, the agent should **pull review
comments** (`get_review_comments`) and act on the open ones. Note this for the
phase-2 build; don't write it here.

## 7. Phasing

- **Phase 1 — app-owned annotations, no MCP.** The `ReviewComment` model + the
  `~/.porcelain/review-comments.json` store (app read/write) + the per-file UI on
  the Feature list. Proves the annotation model with **zero channel risk** and ships
  standalone value (anchored solo-review notes). Its own build plan.
- **Phase 2 — close the loop.** The read-only `get_review_comments` MCP tool +
  `SERVER_INFO` bump + the skill guidance. Its own build plan, gated on phase 1.

Splitting this way means the risky part (the channel) is isolated to phase 2, and
phase 1 is a self-contained, useful feature even if phase 2 never ships.

## 8. Open questions for the maintainer

- **Granularity:** per-file first [recommended] with per-line as an additive
  upgrade, or go straight to per-line?
- **Storage:** `~/.porcelain/review-comments.json` [recommended, server-readable] —
  confirm the home-dir-file shape over any Electron-userData option.
- **Audience:** are annotations an agent-loop feature, or also a first-class
  **solo-review** feature (the recommendation assumes both — solo value in phase 1)?
- **Line-anchoring strategy** (phase 2): bare line number vs. content-snippet anchor?
- **`resolved` state:** does the agent's action mark a comment resolved (a phase-2
  write-back from the agent), or does the human own `resolved` entirely? (A
  write-back would re-open the channel-direction question — default to human-owns.)
- **Channel direction is the highest-stakes line in the design.** This memo's
  recommendation (separate app-owned file, server reads it) is, as far as the
  current invariants allow, the *only* shape that doesn't break the no-inbound-surface
  guarantee. Any alternative the maintainer prefers should be checked against §3
  first.
