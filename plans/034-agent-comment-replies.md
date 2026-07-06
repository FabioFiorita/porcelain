# Plan 034: The agent can answer a review comment, not just resolve it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- src/backend/comment-store.ts src/mcp/comment-file.ts src/mcp/tools.ts src/mcp/protocol.ts src/renderer/src/hooks/use-comments.ts src/renderer/src/components/shell/comments-group.tsx src/main/plugin-assets.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (the comment shape is declared twice — zod app-side, hand parser MCP-side; a missed field silently strips agent data)
- **Depends on**: none
- **Category**: direction (deepens the human↔agent loop)
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

The review-comment loop is asymmetric and lossy: the human writes "why is this
`setTimeout` here?" on a line, and the only thing the agent can send back
through the app is a silent `resolved` flip. The answer — the most valuable
thing the agent could return — has nowhere to land. This plan adds one field
(an agent reply rendered under the comment) and one MCP write tool.

**Provenance**: a full plan for this existed as `plans/021-agent-comment-replies.md`
(written 2026-06-26 against commit `9670e07`, cleared unshipped in `c02e84c`-era
cleanup; retrieve it read-only with `git show f16458d:plans/021-agent-comment-replies.md`
for reference). This plan supersedes it — updated for the daemon split
(`comment-store.ts` moved from `src/main/` to `src/backend/`). Its central
design decision is carried forward verbatim and is **not to be re-litigated**:

> a comment holds **one** agent reply (overwrite on re-answer), not a
> multi-message thread. This mirrors the deliberately-minimal resolve-only
> design and avoids introducing a thread data structure.

## Current state

The channel is `~/.porcelain/comments.json`, shape declared **twice**:

App side (zod), [src/backend/comment-store.ts](../src/backend/comment-store.ts) `:17-33`:

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
export const reviewCommentsSchema = z.record(z.string(), z.array(reviewCommentSchema))
```

The app's mutations run through `channel.mutate` (`createHomeChannel` —
read-whole-file → edit → write-whole-file), so **a field missing from this
schema is dropped the next time the human adds/edits/resolves any comment**.
Same hazard on the MCP side: `parseComments`
([src/mcp/comment-file.ts](../src/mcp/comment-file.ts) `:34-54`) copies fields
**explicitly** —

```ts
const comment: Comment = {
  id: item.id, path: item.path, body: item.body,
  resolved: item.resolved === true,
  createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
}
if (typeof item.startLine === 'number') comment.startLine = item.startLine
...
```

— and `resolveComment` (`comment-file.ts:85-94`) does read-all → mutate →
write-all, so a field IT doesn't copy is lost on the next agent resolve.
**Both copies must gain the new field in the same commit.**

The write-verb exemplar to copy: `resolveComment` (`comment-file.ts:85-94`,
excerpted above) + its dispatch case (`src/mcp/tools.ts:68`) + its TOOLS entry
(`src/mcp/protocol.ts:124`). The read tool's rendering: `describeOne`/
`describeComments` (`comment-file.ts:96-134`) — the agent must SEE an existing
reply so it doesn't blindly re-answer, and the list copy tells the agent to
resolve once addressed.

Renderer side: `src/renderer/src/hooks/use-comments.ts` (domain hook) and
`src/renderer/src/components/shell/comments-group.tsx` (the Comments Quick
Access section). The `comments` app-event already live-refreshes on MCP writes
(`src/backend/review-watch.ts:26` watches `comments.json` → the `comments`
event), so a new reply appears without new push plumbing.

Plugin distribution: the MCP server ships inside the Claude Code plugin.
`src/main/plugin-assets.ts` holds the plugin definitions **including
`PLUGIN_VERSION`** (currently 2.7.0; its doc comment logs one line per
capability bump — read `plugin-assets.ts:17-40`). `plugins/porcelain/server.js`
is a checked-in build artifact of the MCP server (Biome-excluded).

Audit-skill invariants that bind this plan: the MCP server stays
**dependency-free** (Node builtins only — no zod in `src/mcp/`); both writers
stay atomic (tmp + rename); the comment channel's app-supplied paths need no
containment guard; stdio only, no network surface
(`grep -rn "createServer\|listen(" src/mcp` must stay empty).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Targeted  | `pnpm test -- comment`                   | all pass            |
| MCP suite | `pnpm test -- src/mcp`                   | all pass            |
| Full gate | `pnpm verify`                            | exit 0              |

## Scope

**In scope**:
- `src/backend/comment-store.ts` (+ `comment-store.test.ts`)
- `src/mcp/comment-file.ts` (+ `comment-file.test.ts`), `src/mcp/tools.ts`
  (+ `tools.test.ts`), `src/mcp/protocol.ts` (+ `protocol.test.ts` if the TOOLS
  list is asserted there)
- `src/renderer/src/hooks/use-comments.ts`
- `src/renderer/src/components/shell/comments-group.tsx`
- `src/main/plugin-assets.ts` (version bump + changelog comment line)
- `plugins/porcelain/server.js` (regenerated — see Step 6)
- `plugins/porcelain/skills/` — ONLY the review skill's wording if it teaches
  the comment tools (check `plugins/porcelain/skills/`; update the tool list
  where it enumerates `resolve_review_comment`)

**Out of scope**:
- Threads, multi-reply, reply editing — decided against (above).
- A human-side "reply to the reply" — the human's channel is a new comment.
- Any change to the other 8 channels or to `review-watch.ts` (the comments
  watch entry already exists).
- MCP server dependency additions (hand-parse like the existing code).

## Git workflow

- Commit straight to `main` (hook-enforced verify; branches hook-blocked). Do NOT push.
- Message: `feat: agent comment replies — answer_review_comment MCP tool + inline reply under the comment (plugin 2.8.0)`

## Steps

### Step 1: App-side schema + accessor

In `comment-store.ts`, add to `reviewCommentSchema`:

```ts
/** The agent's one reply (overwritten on re-answer), set via the MCP answer tool. */
agentReply: z.object({ body: z.string(), createdAt: z.number() }).optional(),
```

No app-side writer for it (the agent authors it) — but the zod schema carrying
it means the app's read-modify-write no longer strips it. Extend
`comment-store.test.ts`: a stored comment with `agentReply` survives an
app-side `editComment`/`setCommentResolved` round-trip intact.

**Verify**: `pnpm test -- comment-store` → pass.

### Step 2: MCP-side parse + write verb

In `comment-file.ts`:

- `Comment` interface gains `agentReply?: { body: string; createdAt: number }`.
- `parseComments` copies it (validate shape: object, string body, number
  createdAt — same lenient style as the existing fields).
- New exported `answerComment(repoPath: string, id: string, body: string): boolean`
  modeled line-for-line on `resolveComment` (`:85-94`): find the comment, set
  `agentReply = { body, createdAt: Date.now() }` (overwrite), `writeAll`, return
  `false` when the id is unknown. An empty/whitespace `body` returns false
  (don't write blank replies).
- `describeOne` renders an existing reply (e.g. an extra indented line
  `↳ answered: <body first line>`), so the agent sees prior answers;
  `describeComments`'s closing instruction mentions both verbs ("answer with
  answer_review_comment, resolve with resolve_review_comment once addressed").

Extend `comment-file.test.ts` mirroring the resolve tests: answer round-trip,
unknown id → false, blank body → false, overwrite on second answer, and — the
drift guard — a file written by the APP schema with `agentReply` present
survives `resolveComment` (field not stripped).

**Verify**: `pnpm test -- comment-file` → pass.

### Step 3: Tool wiring

- `protocol.ts`: add an `answer_review_comment` TOOLS entry next to
  `resolve_review_comment` (`:124`) — inputs `{ repoPath, id, body }`, all
  required strings; description telling the agent to answer a comment's
  question in one or two sentences and still resolve separately once the
  underlying note is addressed.
- `tools.ts`: add the dispatch case next to the `resolve_review_comment` case
  (`:68`), calling `answerComment` and returning a found/not-found text result
  matching the resolve case's shape.
- Extend `tools.test.ts` (dispatch) and `protocol.test.ts` (if it asserts the
  TOOLS list) following the resolve tests exactly.

**Verify**: `pnpm test -- src/mcp` → all pass.

### Step 4: Render the reply

- `use-comments.ts`: no query change needed (the comment objects flow whole);
  confirm the hook's types come from `@backend/comment-store` (`import type`)
  so the new field is visible. If the hook re-declares a comment type, extend it.
- `comments-group.tsx`: under each comment's body, when `agentReply` exists,
  render an indented reply block — muted foreground, small text, an "Agent"
  label — matching the group's existing row idiom (read the file and imitate
  its spacing/typography; reuse `bg-(--hover-fill)`-style tokens only if the
  surrounding rows do). No new primitive components (shadcn-only rule; plain
  divs + existing classes suffice for an inline block).

Extend the component's test if one exists (`ls src/renderer/src/components/shell/comments-group.test.tsx`);
if none exists, add one modeled on `changes-list.test.tsx` mocking
`use-comments`: a comment with a reply renders the reply text; one without
renders no Agent label.

**Verify**: `pnpm test -- comments-group` → pass.

### Step 5: Plugin version + skill copy

- `plugin-assets.ts`: bump `PLUGIN_VERSION` to `2.8.0` and append the
  changelog comment line in the established style:
  `* 2.8.0: added answer_review_comment — the agent attaches one reply to a review comment (overwritten on re-answer), rendered under the comment in Porcelain.`
- `plugins/porcelain/skills/`: grep for `resolve_review_comment`; where a skill
  enumerates the comment tools, add the answer verb with one sentence of
  guidance (answer questions; still resolve when addressed).

**Verify**: `grep -rn "answer_review_comment" plugins/porcelain/skills src/main/plugin-assets.ts` shows the additions.

### Step 6: Regenerate the checked-in server bundle

`plugins/porcelain/server.js` is a build artifact of `src/mcp/`. Determine the
generation path before touching it: read `src/main/plugin.ts` +
`plugin-assets.ts` (the installer copies the BUILT `out/main/mcp/server.js`)
and check `git log --oneline -3 -- plugins/porcelain/server.js` for how past
bumps produced it. Expected: `pnpm build`, then copy `out/main/mcp/server.js`
over `plugins/porcelain/server.js`. If the provenance is anything else, STOP.

**Verify**: after the copy, `node -e "const s=require('node:fs').readFileSync('plugins/porcelain/server.js','utf8'); process.exit(s.includes('answer_review_comment')?0:1)"` → exit 0.

### Step 7: Full gate + invariant walk

`grep -rn "createServer\|listen(" src/mcp` → nothing;
`grep -rn "from 'zod'" src/mcp` → nothing new.

**Verify**: `pnpm verify` → exit 0.

## Test plan

Steps 1–4's cases. The two **drift-guard** tests are the ones that matter most
(field survives the *other* side's read-modify-write, in both directions) —
model them on whatever cross-side fixtures `comment-file.test.ts` already uses.

## Done criteria

- [ ] `pnpm verify` exits 0
- [ ] `pnpm test -- comment` shows the two drift-guard cases passing
- [ ] `answer_review_comment` present in `protocol.ts` TOOLS, `tools.ts`
      dispatch, and the regenerated `plugins/porcelain/server.js`
- [ ] `PLUGIN_VERSION === '2.8.0'` with its changelog line
- [ ] A comment with a reply renders the reply in `comments-group` (test green)
- [ ] `grep -rn "createServer\|listen(" src/mcp` → no matches
- [ ] `plans/README.md` status row updated

## STOP conditions

- The `plugins/porcelain/server.js` provenance is not "copy of
  `out/main/mcp/server.js`" (Step 6) — report before writing to it.
- You find yourself adding a `replies[]` array or reply-editing — that's the
  rejected thread design; stop.
- The comments-group component has structure that makes an inline reply block
  require a new primitive — get approval (shadcn-only rule) rather than
  hand-rolling one.
- `protocol.test.ts` asserts an exact TOOLS count/order that suggests external
  consumers pin it — note it in the report and update deliberately.

## Maintenance notes

- The two-copy schema is the standing trap: ANY future comment field must land
  in `reviewCommentSchema` AND `parseComments` in the same commit — the drift
  guards from Step 2 make forgetting fail a test, which is the point.
- Pairs naturally with plan 035 (an unread signal when a reply arrives) — the
  `comments` app-event already fires on the write; 035 decides how to surface it.
- Deferred by design: threads, human replies-to-replies, reply timestamps in
  the UI beyond ordering.
