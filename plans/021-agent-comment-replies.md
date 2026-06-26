# Plan 021: The agent can reply to a review comment, not just resolve it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 9670e07..HEAD -- src/mcp/comment-file.ts src/main/comment-store.ts src/mcp/tools.ts src/mcp/protocol.ts src/main/api.ts src/renderer/src/hooks/use-comments.ts src/renderer/src/components/shell/comments-group.tsx src/main/plugin-assets.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the two-copy comment schema; a missed field silently strips agent data)
- **Depends on**: none
- **Category**: direction (deepens the human↔agent loop)
- **Planned at**: commit `9670e07`, 2026-06-26

## Why this matters

The two-way agent loop is Porcelain's actual differentiator (README: *"Your
review comments become its context; its work, resolutions, and the whole-feature
manifest flow back to you"*). But today the loop on review comments is
**asymmetric and lossy**: the human writes a note on a line, and the only thing
the agent can send back is a silent `resolved: boolean` flip. When the human
asks *"why is this `setTimeout` here?"*, they get a checkmark, never the answer.
The agent's reasoning — the most valuable thing it could return — has nowhere to
land in the app.

This plan adds one field: the agent attaches a short **reply** to a comment via a
new `answer_review_comment` MCP tool, and Porcelain renders it inline under the
comment. It's the smallest change that closes the loop the human can actually
read, and it lands entirely on existing surfaces (the comment channel + the
Comments Quick Access group). No editor features, no network — fully on-identity.

**Design decision already made (do not re-litigate):** a comment holds **one**
agent reply (overwrite on re-answer), not a multi-message thread. This mirrors
the deliberately-minimal resolve-only design and avoids introducing a thread data
structure. If the maintainer later wants threads, that is a separate, larger
plan — see STOP conditions.

## Current state

The review-comment channel is one JSON file (`~/.porcelain/comments.json`) keyed
by repo path, with the **same `Comment` shape declared twice** — once on the app
side (zod) and once on the dependency-free MCP side (hand parser). **Both copies
must carry every field, or the side whose parser omits it will strip that field
on its next write.** This is the central risk of this plan.

- `src/main/comment-store.ts` — APP side (zod). The app authors comments and may
  flip `resolved`. `src/mcp/comment-file.ts` — MCP side (no deps). The agent
  reads comments and may flip `resolved`. Lines 7–9 of `comment-file.ts` spell
  out the channel direction.

App-side schema (`src/main/comment-store.ts:17-30`):

```ts
export const reviewCommentSchema = z.object({
  id: z.string(),
  path: z.string().min(1),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  anchorText: z.string().optional(),
  body: z.string(),
  resolved: z.boolean().default(false),
  createdAt: z.number(),
})
export type ReviewComment = z.infer<typeof reviewCommentSchema>
```

The app's mutations all go through `channel.mutate`, which reads the whole file
(zod-parsed), edits, and writes it back — so **a field missing from this schema
is dropped the next time the human edits/resolves/adds any comment**
(`comment-store.ts:77-100`).

MCP-side interface + parser (`src/mcp/comment-file.ts:12-54`):

```ts
export interface Comment {
  id: string
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
  body: string
  resolved: boolean
  createdAt: number
}
// parseComments() copies fields explicitly (lines 41-51); resolveComment()
// reads-all → mutates → writes-all (lines 85-93), so a field it doesn't copy is
// lost on the next agent resolve.
```

MCP write verb today (`src/mcp/comment-file.ts:84-94`):

```ts
export function resolveComment(repoPath: string, id: string): boolean {
  const all = readAll()
  const comments = all[repoPath]
  if (!comments) return false
  const target = comments.find((c) => c.id === id)
  if (!target || target.resolved) return false
  target.resolved = true
  writeAll(all)
  return true
}
```

MCP read rendering (`src/mcp/comment-file.ts:96-134`): `describeOne` formats one
comment for the agent; `describeComments` lists the open ones. The agent must be
able to SEE an existing reply so it doesn't blindly re-answer.

MCP tool dispatch (`src/mcp/tools.ts:67-73`) — the `resolve_review_comment` case
is the exemplar to copy for the new write tool. Tool schema list lives in
`src/mcp/protocol.ts` (the `TOOLS` array; the `resolve_review_comment` entry is
`protocol.ts:123-135`). `tools/list` returns this array verbatim.

App read path: `reviewComments` tRPC query (`src/main/api.ts:746-748`) →
`useReviewComments` (`src/renderer/src/hooks/use-comments.ts:6-10`) →
`CommentsGroup`/`CommentRow` (`src/renderer/src/components/shell/comments-group.tsx`).
The watcher already live-refreshes the app when `comments.json` changes
(`src/main/review-watch.ts:23-27`, the `comments` event), so an agent reply
appears without any new push wiring.

The skill the agent reads is the `REVIEW_SKILL` string in
`src/main/plugin-assets.ts:101-155` (its "Reviewer comments" section,
lines 139-146, currently documents only `get_review_comments` +
`resolve_review_comment`). `PLUGIN_VERSION` is `'2.6.0'`
(`plugin-assets.ts:37`) and MUST be bumped when an MCP tool is added, with a
changelog line in the block comment above it (the file documents this rule at
lines 16-36).

**Conventions to match:** named exports, explicit return types, inline-typed
props (`architecture` skill). For the new MCP write function, copy the exact
shape of `resolveComment` (read-all → find → mutate → write-all, return a
boolean found/changed). For the tRPC read shape, the app does NOT author replies
— so there is **no** app-side write procedure; the app only reads the field.
Tests sit next to source (`*.test.ts` / `*.test.tsx`).

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install`                   | exit 0              |
| Lint      | `pnpm lint`                      | exit 0              |
| Typecheck | `pnpm typecheck`                 | exit 0, no errors   |
| Unit test | `pnpm test <filter>`             | all pass            |
| Full gate | `pnpm verify`                    | all four pass       |

`pnpm verify` = `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, and it
is **hook-enforced before any commit** — a failing gate blocks the commit.
Commit straight to `main` (no branches — the git-guard hard-blocks them).

## Scope

**In scope:**
- `src/mcp/comment-file.ts` — add `answer?` to `Comment` + `parseComments`; add
  `answerComment(...)`; surface an existing answer in `describeOne`.
- `src/mcp/comment-file.test.ts` — cover the new function + rendering.
- `src/mcp/tools.ts` — add the `answer_review_comment` dispatch case.
- `src/mcp/tools.test.ts` — cover the new dispatch.
- `src/mcp/protocol.ts` — add the `answer_review_comment` tool to `TOOLS`.
- `src/main/comment-store.ts` — add `answer?` to `reviewCommentSchema`.
- `src/main/comment-store.test.ts` — cover the field round-tripping.
- `src/renderer/src/components/shell/comments-group.tsx` — render the reply.
- `src/main/plugin-assets.ts` — document the tool in `REVIEW_SKILL`; bump
  `PLUGIN_VERSION` to `2.7.0` with a changelog line.

**Out of scope (do NOT touch, even though they look related):**
- Anything that lets the **app** author or edit the answer. The answer is the
  agent's; the app is read-only on it (mirrors how `resolved` is the only
  two-way field). Do not add an `editAnswer` tRPC procedure or UI affordance.
- The multi-message thread design — explicitly deferred (see STOP conditions).
- `resolveComment` / `resolved` semantics — leave the resolve flow untouched.
- The other agent channels (board, actions, layers, review-sets, notes,
  reviewed, feature-view). This plan is the comment channel only.

## Steps

### Step 1: Add the `answer` field to BOTH schema copies (no behavior yet)

The field must exist in both parsers before anything writes it, so neither side
strips it.

1a. In `src/main/comment-store.ts`, add to `reviewCommentSchema` (after
`anchorText`, before `body`, or after `resolved` — placement is cosmetic):

```ts
  /** The agent's reply to this comment, set over MCP via answer_review_comment. */
  answer: z.string().optional(),
```

`ReviewComment` updates automatically (it's `z.infer`). No code change to
`addComment`/`editComment`/`deleteComment`/`setCommentResolved` is needed — they
round-trip the whole object, and the field now survives the zod parse.

1b. In `src/mcp/comment-file.ts`, add `answer?: string` to the `Comment`
interface (after `resolved` / before `createdAt`), and in `parseComments` copy it
through (mirror the `anchorText` line at `comment-file.ts:50`):

```ts
    if (typeof item.answer === 'string') comment.answer = item.answer
```

**Verify**: `pnpm typecheck` → exit 0. `pnpm test comment-store comment-file` →
all existing tests still pass (no behavior changed yet).

### Step 2: Add the `answerComment` write function (MCP side)

In `src/mcp/comment-file.ts`, directly below `resolveComment`, add — copying its
read-all → find → mutate → write-all shape:

```ts
/** Attach (or replace) the agent's reply to a comment. Returns true if found. */
export function answerComment(repoPath: string, id: string, answer: string): boolean {
  const all = readAll()
  const target = all[repoPath]?.find((c) => c.id === id)
  if (!target) return false
  target.answer = answer
  writeAll(all)
  return true
}
```

Also surface an existing answer to the agent in `describeOne` (so it can see what
it already replied) — append after the `body` in the returned string
(`comment-file.ts:108`), e.g.:

```ts
  const replied = c.answer ? `\n    ↳ your reply: ${c.answer.replace(/\n/g, '\n      ')}` : ''
  return `- [${c.id}] ${where}${tag}${anchor}\n    ${c.body}${replied}`
```

**Verify**: `pnpm test comment-file` → passes (you'll add assertions for this in
Step 5; for now confirm nothing broke).

### Step 3: Wire the MCP tool — dispatch + schema

3a. In `src/mcp/tools.ts`, add `answerComment` to the import from `./comment-file`
(line 17) and add a dispatch case modeled on `resolve_review_comment`
(`tools.ts:67-73`):

```ts
  if (name === 'answer_review_comment') {
    const id = asString(args.id)
    const answer = asString(args.answer)
    if (!id) throw new Error('id is required')
    if (!answer) throw new Error('answer is required')
    return answerComment(repoPath, id, answer)
      ? `Replied to comment ${id} for ${repoPath}`
      : `No comment ${id} for ${repoPath}`
  }
```

3b. In `src/mcp/protocol.ts`, add an entry to the `TOOLS` array (place it right
after the `resolve_review_comment` entry, `protocol.ts:123-135`):

```ts
  {
    name: 'answer_review_comment',
    description:
      "Reply to one of the reviewer's comments, by its id (from get_review_comments). Your answer appears inline under the comment in Porcelain, so the human sees your reasoning — use it to explain why something is the way it is, what you changed, or to ask a clarifying question. Setting an answer again replaces the previous one. Answering does NOT resolve the comment; call resolve_review_comment separately once the note is actually addressed.",
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Absolute path to the repository' },
        id: { type: 'string', description: 'The comment id from get_review_comments' },
        answer: { type: 'string', description: 'Your reply, shown under the comment to the human' },
      },
      required: ['repoPath', 'id', 'answer'],
    },
  },
```

**Verify**: `pnpm typecheck` → exit 0. `pnpm test tools protocol` → passes.

### Step 4: Render the reply in the Comments group (app UI)

In `src/renderer/src/components/shell/comments-group.tsx`, inside `CommentRow`,
render `comment.answer` when present — a small block below the body button
(around `comments-group.tsx:85`, after the `</button>` that closes the body). Use
existing tokens; match the row's muted/`text-xs` idiom and the `glaze` material
already in use:

```tsx
      {comment.answer && (
        <div className="mt-1 border-l-2 border-border/60 pl-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">Agent</span> {comment.answer}
        </div>
      )}
```

(Adjust class names only if `pnpm lint`/the design idiom requires it — do not
invent new color tokens; reuse `muted-foreground`/`border`/`foreground`. See the
`architecture` skill's "one glass interaction language" note if you reach for a
fill.)

**Verify**: `pnpm lint && pnpm typecheck` → exit 0.

### Step 5: Tests

Write the tests described in the **Test plan** below.

**Verify**: `pnpm test comment-file comment-store tools` → all pass, including the
new cases.

### Step 6: Teach the agent + bump the plugin version

6a. In `src/main/plugin-assets.ts`, extend the `REVIEW_SKILL` "Reviewer comments"
section (lines 139-146) with a bullet for the new tool, e.g.:

```
- \`answer_review_comment\` — \`{ repoPath, id, answer }\` → reply to a comment so the human sees your reasoning inline (why something is the way it is, what you changed, or a clarifying question). This does NOT resolve it — call \`resolve_review_comment\` separately once you've addressed the note.
```

6b. Bump `PLUGIN_VERSION` from `'2.6.0'` to `'2.7.0'` (`plugin-assets.ts:37`) and
add a changelog line to the block comment above it (match the existing
`2.6.0:` line style):

```
 * 2.7.0: added answer_review_comment — the agent can reply to a review comment
 *        (one reply per comment, app→app read-only display); plus the review skill bullet.
```

**Verify**: `pnpm test plugin-assets` → passes (`plugin-section.test.tsx` and any
`plugin-assets`-touching test still green; if a test pins `PLUGIN_VERSION` or the
tool count, update it to match and note it in your status row).

### Step 7: Full gate

**Verify**: `pnpm verify` → all four commands pass.

## Test plan

- `src/mcp/comment-file.test.ts` (model after the existing cases in this file):
  - `answerComment` sets the field and returns `true`; returns `false` for an
    unknown id; a second call **overwrites** the prior answer.
  - `parseComments` preserves `answer` on a round-trip (write an object with an
    `answer`, read it back).
  - `describeComments`/`describeOne` includes the reply text when `answer` is set.
- `src/mcp/tools.test.ts` (model after the existing dispatch cases): calling
  `callTool('answer_review_comment', { repoPath, id, answer })` writes the answer
  and returns the success string; missing `id` or `answer` throws.
- `src/main/comment-store.test.ts`: a comment with an `answer` survives an
  unrelated app mutation — e.g. `addComment` a second comment, then assert the
  first comment's `answer` is still present (proves the zod schema doesn't strip
  it). Also assert `editComment` on the answered comment keeps its `answer`.
- Verification: `pnpm test comment-file comment-store tools` → all pass,
  including the new cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm verify` exits 0 (lint, typecheck, test, build).
- [ ] `grep -n "answer_review_comment" src/mcp/protocol.ts src/mcp/tools.ts` → a
      hit in each.
- [ ] `grep -n "answer" src/main/comment-store.ts src/mcp/comment-file.ts` → the
      field is present in BOTH the zod schema and the `Comment` interface +
      `parseComments`.
- [ ] `grep -n "2.7.0" src/main/plugin-assets.ts` → version bumped + changelog
      line present.
- [ ] New tests for `answerComment`, the dispatch, and the schema round-trip
      exist and pass.
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] `plans/README.md` status row for plan 021 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (the
  comment channel drifted since this plan was written) — especially if a
  `answer`/`reply`/`thread` field already exists.
- You find the maintainer actually wants a **multi-message thread** (the human
  and agent going back and forth), not a single reply. That is a different data
  model (an array of messages, ordering, who-said-what) and a bigger UI — stop
  and confirm the design before building it.
- Adding the field appears to require a write path **from the app** (e.g. the
  human editing the agent's reply). It does not; if a requirement pushes you
  there, stop — that breaks the "answer is the agent's" model.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The two-copy schema is the thing to watch.** `comment-store.ts` (zod) and
  `comment-file.ts` (hand parser) describe the same record independently; any
  future field must be added to BOTH or the side that omits it silently strips it
  on its next write. A reviewer should check that every new comment field appears
  in both files and in both test suites.
- The watcher (`review-watch.ts`) already refreshes the app on `comments.json`
  changes, so the reply appears live — no extra push wiring. If the channel ever
  moves off the directory-watch model, re-confirm replies still live-refresh.
- Deferred on purpose: multi-message threads, app-side editing of the reply, and
  any "unread reply" badge. Single overwrite-able reply was chosen to match the
  minimal resolve-only design; revisit only if users ask for a conversation.
- Plugin version discipline: this bumps to `2.7.0`. The Settings → Agents section
  will offer "Update to v2.7.0" to anyone on an older plugin (that flow already
  exists — `plugin-section.tsx`), so no extra UI work.
