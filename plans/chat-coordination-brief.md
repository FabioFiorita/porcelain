I have full picture. Here is the design brief.

---

# DESIGN BRIEF: Multi-agent coordination via structured chat claims

## 1. Current schema + flow

**Message shape is defined TWICE** (must be kept in lockstep — no shared module because the CLI is a dependency-free `node` bundle that can't import zod from inside `app.asar`):

- **CLI side** — `src/cli/chat-file.ts:12-17` — `interface ChatMessage { id, from, body, createdAt }`, hand-parsed by `parseMessages` (`chat-file.ts:29-44`, drops any item missing string `id`/`from`/`body`; `createdAt` defaults to `0`).
- **Backend side** — `src/backend/chat-store.ts:11-18` — `chatMessageSchema` (zod): `id: string`, `from: string().min(1)`, `body: string().min(1)`, `createdAt: number().default(0)`. `ChatMessage` type is exported from here and is the one the **renderer imports** (`chat-message-row.tsx:1`, `use-chat.ts:1`).
- Storage: `Record<absoluteRepoPath, ChatMessage[]>` in `~/.porcelain/chat.json` (`chatSchema` `chat-store.ts:20`; CLI `Chat` type `chat-file.ts:19`). Soft cap `MAX_CHAT_MESSAGES = 200`, oldest dropped after each post (`chat-store.ts:52-54`, `chat-file.ts:80-82`).

**End-to-end flow (CLI write → live UI):**
1. `porcelain chat post --from X --body Y` → dispatch `chat-file.ts` posts via `postMessage` (`cli.ts:443-448`) — atomic tmp+rename write (`chat-file.ts:59-65`).
2. Daemon watches the **directory** (not file — atomic rename swaps the inode): `review-watch.ts:34` maps `chat.json` → `'chat'` AppEvent, emitted on any change (`review-watch.ts:46-54`).
3. Renderer WS handler `use-app-events.ts:79-81`: on `'chat'` → `utils.chatMessages.invalidate()`. Also `unread.ts:63-64` lights the Chat rail dot.
4. tRPC procedures `api.ts:1115-1134`: `chatMessages` (query, input = repo path string), `postChatMessage`, `clearChatMessages`. Backed by `chat-store.ts` `readMessages`/`postMessage`/`clearMessages`.
5. Hook `use-chat.ts:7-11` `useChatMessages()` → `{ messages, error }`; `useChatActions()` `use-chat.ts:13-40` for post/clear.
6. Render: **`ChatList`** (sidebar, `chat/chat-list.tsx`) shows last 12 (`:23`) via `ChatMessageRow compact`; **`ChatView`** (viewer, `chat/chat-view.tsx`) shows full thread; both use **`ChatMessageRow`** (`chat/chat-message-row.tsx:19-48`) — a `glaze-tile` with `from` + relative time header and a `whitespace-pre-wrap` body. `ChatComposer` (`chat/chat-composer.tsx`) is the human's post form, default `from="you"` (`:16`).

Note the actual paths differ from the task's guess: components are under `src/renderer/src/components/chat/` (not `.../sidebar/` or `.../viewer/`); the viewer wires `kind: 'chat'` at `viewer.tsx:99`.

## 2. Claims schema proposal

A claim is **still a chat message** — just carrying two optional fields. Plain messages stay byte-identical (no new keys serialized), so backward-shape-compat is automatic and old readers ignore claims gracefully.

Add to **both** definitions:

```ts
// chat-store.ts chatMessageSchema (zod)
files:  z.array(z.string().min(1)).max(50).optional(),  // repo-relative paths claimed
intent: z.string().max(280).optional(),                 // one-line "working on X"
closes: z.boolean().optional(),                          // this message closes the poster's open claim
```

```ts
// chat-file.ts ChatMessage interface + parseMessages
files?: string[]; intent?: string; closes?: boolean
```
In `parseMessages` (`chat-file.ts:32-42`): accept `files` only if `Array.isArray` and every entry is a non-empty string (else omit); `intent` only if `typeof === 'string'` and non-empty; `closes` only if `=== true`. Never throw — a malformed claim degrades to a plain message, matching the existing lenient parse.

**A message is "a claim" iff `files` is present and non-empty.** `intent` alone (no files) is just a message with a subtitle — not tracked for overlap.

**Expiry/close — recommendation: hybrid, close-message primary + TTL backstop.**
- **Primary: explicit close.** Agent posts `chat post --from X --closes --body "done with auth"` (no `--files`). `closes: true` from label `X` retires **all** of `X`'s currently-open claims. This is deterministic and matches the advisory, human-readable ethos (the thread literally reads "claimed… done").
- **Backstop: TTL.** A claim is "live" only if `Date.now() - createdAt < CLAIM_TTL_MS` (recommend **6h**, exported constant). Reason: agents crash / forget to close, and a locking-free advisory system must self-heal — a stale claim that never expires would produce permanent false-overlap noise. TTL is derived at read time (no writes, no reaper), so it costs nothing and can't race.
- **Supersede:** a newer claim from the same `from` replaces that agent's prior open claim set (an agent working on one thing at a time; re-posting `--files` updates the footprint). Keep it simple: "live claim for an agent = its most-recent claim message, if within TTL and not followed by a `--closes` from that agent."

No new file, no new channel, no DB — everything rides `chat.json` and is derived on read. This keeps the "one JSON channel" invariant.

## 3. Overlap detection

**Renderer-side derivation**, in a new hook (e.g. `use-chat-claims.ts` beside `use-chat.ts`) that consumes `useChatMessages()`. This matches the codebase's uniform rule: **the app derives view-state in the component/hook from the raw channel list.** Precedent: `comments-group.tsx:150-152` derives open/closed counts from the comment array; `right-sidebar.tsx` selects sections purely from `sidebarTab`; there is no daemon-side "derived" endpoint for any channel. The daemon only reads/writes raw JSON and emits the `'chat'` invalidation — adding claim logic there would fork the architecture (rule 1) and duplicate it in the dependency-free CLI.

**Derivation, in order:**
1. Fold messages → `liveClaims: Map<from, { files: string[]; intent?: string; at: number }>`: for each `from`, take its latest message; keep only if it has non-empty `files`, is within `CLAIM_TTL_MS`, and no later `--closes` from that same `from`.
2. **Overlap rule (exact):** two live claims from **different** `from` labels overlap iff their `files` sets intersect on ≥1 path. Compare **normalized** repo-relative strings (trim, strip leading `./`; the CLI already keys everything repo-relative). Emit one warning per unordered pair, listing the shared file(s).
3. `participants`: distinct `from` values across all messages (not just claimants) with their last-message time — this is a plain reduce over `messages`, independent of claims.

Keep the CLI's `describeChat` (§5) doing its **own** minimal fold so `chat list` shows claims without importing renderer code — small duplication, same as the schema duplication, and justified by the asar constraint.

## 4. UI sketch — Chat Quick Access panel

Today the right panel shows **nothing** for `chat` (`right-sidebar.tsx:53-63` has no `chat` branch; `COMPANION_TITLES.chat = 'Workspace'` at `:26`). Add a `{sidebarTab === 'chat' && <ChatQuickAccess />}` line and a new `chat/chat-quick-access.tsx` composed of **three `SidebarGroup` sections**, following `comments-group.tsx` / `pinned-group.tsx` exactly (`SidebarGroup className="px-3"` → `SidebarGroupLabel` in `text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground` → `SidebarGroupContent`, rows as `glaze-tile … [--tile-fill:var(--surface-2)]`). Retitle `COMPANION_TITLES.chat` to **`'Coordination'`** (`right-sidebar.tsx:26`).

- **Participants** — label `Participants · N`. One row per distinct `from`: the label (mono/medium like `chat-message-row.tsx:35`) + relative last-seen time (reuse `formatTime` from `chat-message-row.tsx:4-16`, or lift it to `lib/`). Empty state mirrors `pinned-group.tsx:19-22` prose.
- **Active claims** — label `Claims · N`. One `glaze-tile` per live claim: `from` header, `intent` as the body line, and the file list as small mono chips (reuse the mono/`text-xs-minus` file-name treatment from `comments-group.tsx:62-66`, `fileName()` from `lib/paths`). Clicking a file opens it via `openTab({ kind:'file', … })` — copy the `open()` handler in `comments-group.tsx:40-50`. Empty state: "No active claims. Agents declare files with `chat post --files`."
- **Overlaps** — label `Overlaps`, hidden when zero (like `ClearResolvedButton` hides at count 0, `comments-group.tsx:116`). Each warning is a tile with a warning accent (`text-destructive` or an `amber`/warning token — check the design system; use `AlertTriangle` from `lucide-react`) reading `X and Y both touching foo.ts, bar.ts`. Advisory only — no action buttons.

**Claim rendering in the thread (`ChatMessageRow`, `chat-message-row.tsx`):** when `message.files?.length`, render the normal `from`/time header, then `intent` (if present) as the body line, then the file list as a compact chip row below (`flex flex-wrap gap-1`, each chip `text-2xs font-mono` in a muted pill). Add a small leading `FolderGit2`/`GitBranch` icon or a `Claim` tag (`text-2xs uppercase`, same treatment as the "Agent" reply tag at `comments-group.tsx:99-101`) so a claim is visually distinct from prose. A `--closes` message renders as a subtle "closed: …" line (reduced opacity, like `comments-group.tsx:56` `resolved && 'opacity-55'`). Keep `compact` honoring the sidebar density (`chat-message-row.tsx:22`).

Reuse, not build: `SidebarGroup*`, `glaze-tile`, `Button` ghost/icon-sm, `lucide-react` icons, `fileName`, `formatTime` — no new shadcn primitive needed (satisfies hard rule 5).

## 5. CLI surface (`src/cli/cli.ts`)

The parser is hand-rolled getopt (`cli.ts:83-106`): `--name value` pairs, bare tokens positional, `help`/`version` in `BOOLEAN_FLAGS` (`:71`). **`--closes` is a boolean flag** → add `'closes'` to `BOOLEAN_FLAGS` (`cli.ts:71`) so `--closes` with no following value is recorded present.

Extend the existing `chat post` case (`cli.ts:443-448`) — do **not** add a new verb:

```
{ verb: 'post',
  args: '--from <s> --body <s> [--files <csv>] [--intent <s>] [--closes]',
  desc: 'Post a message or a file claim' }
```
(edit the `COMMANDS` chat entry `cli.ts:246-253`; add `files`, `intent` to its `flags` array so they show under `chat --help`.)

Add to `FLAG_DESCRIPTIONS` (`cli.ts:128-145`):
```
files: 'Repo-relative paths you are working on, comma-separated — declares a claim so other agents see the overlap'   // NB: reused key; today files is JSON for review. See caveat below.
intent: 'One line on what you are doing, e.g. "refactoring auth"'
closes: 'Retire your open claim (pair with --body to say what finished)'
```
**Caveat — `--files` key collision:** `FLAG_DESCRIPTIONS.files` (`cli.ts:131-133`) is already the JSON-array flag for `review set/add`. Per-noun help is fine (each noun lists its own flags), but the single shared `FLAG_DESCRIPTIONS` map has one description. **Recommendation:** the review side uses JSON (`readJson('files')`, `cli.ts:340-344`), the chat side wants a **plain CSV** (agents shouldn't hand-write JSON for a quick claim). Parse chat's `--files` as CSV in the `chat post` case directly (`opt('files')?.split(',').map(s=>s.trim()).filter(Boolean)`), independent of `readJson`. Keep the shared description generic ("Files: for `review`, JSON array; for `chat`, comma-separated paths") **or** — cleaner — override in the per-noun render. Flag this to the implementer; the JSON-vs-CSV split is the one real design fork.

`chat post` handler becomes: build `{ from, body, files?, intent?, closes? }`, pass to `postMessage` (extend `chat-file.ts:72` signature to take an options object like `chat-store.ts:41-44` already does). Return string: `Posted claim ${id} as "${from}" — 3 file(s)` when files present, else the existing message text (`cli.ts:447`).

**`chat list` output (`describeChat`, `chat-file.ts:96-106`):** keep the plain-message line as-is (`:103`). For a live claim append the footprint: 
```
- [id] <when> · <from> [CLAIM] intent — files: a.ts, b.ts
```
and after the message loop, add a derived **`Live claims`** block and an **`⚠ Overlaps`** block (same fold as §3, TTL-filtered) so a headless agent running `chat list` sees conflicts without the GUI:
```
Live claims (2):
  - alice: auth.ts, session.ts  ("wiring login")
  - bob: session.ts             ("adding logout")
⚠ Overlap: alice & bob both touching session.ts
```
This is the agent-facing half of the same information the Quick Access panel shows the human.

## 6. Dependency note — preamble alignment

Current preamble (`porcelain-preamble.ts:23`, last sentence):
> "If other agents share this repo, announce the files you're touching with `chat post` and check `chat list` before big edits."

**The verbs already match** — `chat post` and `chat list` are exactly the surface proposed, and "announce the files you're touching" maps to the new `--files`. But it under-specifies: an agent reading it today would post free prose, not a structured claim, so overlap detection (§3) never fires. **Recommended wording change** (one sentence, `porcelain-preamble.ts:23`):

> "If other agents share this repo, before big edits run `chat list` to see who's touching what, and claim your files with `chat post --from <you> --files a.ts,b.ts --intent \"what you're doing\"`; post `chat post --from <you> --closes` when done."

This makes the `--files`/`--intent`/`--closes` surface load-bearing in the instruction the agent actually receives. Note the preamble is delivered per-driver (`porcelain-preamble.ts:7-18`) and is a **cache-stable constant** — changing this string is safe (it just changes the cached prefix once) but should be a deliberate edit in the same track that ships the CLI flags, so the instruction never references a flag the installed CLI lacks.

---

**Files a build touches:** `src/backend/chat-store.ts` (schema + `postMessage` sig), `src/cli/chat-file.ts` (interface, `parseMessages`, `postMessage` sig, `describeChat`), `src/cli/cli.ts` (`BOOLEAN_FLAGS`, `COMMANDS` chat entry, `FLAG_DESCRIPTIONS`, `chat post` case), `src/backend/api.ts:1119-1130` (postChatMessage input + call), `src/renderer/src/hooks/use-chat.ts` (post signature) + new `use-chat-claims.ts`, `src/renderer/src/components/chat/chat-message-row.tsx` (claim rendering) + new `chat/chat-quick-access.tsx`, `src/renderer/src/components/shell/right-sidebar.tsx:26,53-63` (title + wiring), `src/backend/agents/porcelain-preamble.ts:23` (wording). No new watcher/AppEvent/tRPC procedure needed — claims ride the existing `'chat'` event and `chatMessages` query.
