# 03 — Review tab (and the Board screen)

Plan for the native Review tab: the phone half of Porcelain's moat surface. Written to be
executed by a fresh agent in a managed worktree with no other context than this file plus
the sources it names. **Verified against the daemon on 2026-07-31.**

Required reading before writing code: `apps/mobile/docs/daemon-api.md` (Review-tab
catalog), `apps/mobile/README.md`, `.agents/skills/product/SKILL.md` (the Review feature —
Intent · Execution · Evidence, lifecycle, Board↔Review coupling),
`.agents/skills/architecture/SKILL.md` → "Native mobile client", `.claude/skills/expo-ui/`
(+ `references/swift-ui.md`),
`.claude/skills/expo-router/` (+ `references/form-sheet.md`, `toolbar-and-headers.md`).

Depends on plan `00-connection.md`, which **merges first**: it owns the daemon client, the
paired-environment/session state, the selected repo, the tRPC + React Query seam and the
WS app-event stream under `apps/mobile/src/lib/daemon/`. This plan **consumes** those seams
and never re-implements them. Its §2 is the binding contract — the names used below
(`useDaemonQuery`, `useDaemonMutation`, `useDaemonInvalidate`, `useActiveRepo`,
`useActiveEnvironment`, `useDaemonSession`, `DaemonGate`, `APP_EVENT_INVALIDATIONS`) come
from there. If implementation forces a change, change it **in 00** and say so; don't fork.

---

## 1. Mission

Make a phone the place where a human **reads and signs off on** agent work away from the
desk. The Review tab renders the agent's published review set as a story: **Intent** (what
this is and the idea, read one chapter at a time), **Execution** (only the files the agent
listed, in the agent's order, with its notes, marked reviewed as you go), **Evidence** (the
pass/fail checks plus the agent's HTML proof rendered in a sandboxed WebView). The human's
side of the loop is reading, commenting, and marking reviewed; the agent's side —
authoring the review set, replying to comments, resolving them — stays on the agent. The
pushed **Board** screen is the queue behind the story: planning-lite, never a second
review. Everything here is a fourth client of the same daemon; no mobile-only procedure,
no second diff panel, no commit UX.

## 2. UX shape

### 2.1 The three faces

The desktop canvas has three tabs. On the phone they are **three faces of one screen**,
switched by a native **segmented control** pinned under the header, above the scrolling
body. Face is local `useState<ReviewFace>` — not a route: a face is not a destination, and
back must leave Review rather than step backwards through faces.

A menu-style picker hides the product's spine behind a tap, so the switcher is a **segmented**
control. With `@expo/ui/swift-ui` as the app's only UI layer (rule 5) this is ordinary code, and
one file rather than a platform-split pair:

- `features/review/face-switcher.tsx` — `@expo/ui/swift-ui` `Picker` with
  `modifiers={[pickerStyle('segmented')]}` and `Text` children carrying `tag('intent'|…)`,
  taking `{ face: ReviewFace; onChange(face: ReviewFace): void; evidenceEnabled: boolean }`.

Everything else in this slice is the same layer — there is no ladder to climb any more.

Evidence is **disabled when `reading.evidence === null`** (mirrors the desktop's disabled
tab); if evidence disappears while Evidence is active, fall back to Intent.

### 2.2 Lifecycle cue (read-only)

Port the desktop rule verbatim into `features/review/lifecycle.ts` (source of truth:
`src/renderer/src/lib/review-lifecycle.ts`):

```
reading === null                                            → 'empty'          (no badge)
evidence !== null || (reviewedFraction >= 0.5 && outlineFiles.length > 0)
                                                            → 'ready_to_close' ("Ready to close")
otherwise                                                   → 'in_progress'    ("In progress")
```

`outlineFiles` = unique file paths across `sections[].files` + `groups[].files`;
`reviewedFraction = reviewedPaths ∩ outlineFiles / outlineFiles.length`. Render as a small
badge in the header area of the Intent face. **Read-only:** no "Copy prompt" buttons (a
desktop clipboard affordance for feeding an agent), and "Ready to close" links to the
**Changes** tab as a hand-off, never a commit control here.

### 2.3 Intent — chapters, not a scroll

`featureReading` gives `thesis`, `sections: { title, prose (markdown), diagram? (inline
SVG), html?, htmlHeight?, files }`, and an optional `canvas`.

Decision: **Intent is an outline, chapters are pushed screens.** The desktop's J/K chapter
stepping has no phone analogue (no keyboard, and `@expo/ui/swift-ui` `ScrollView` exposes no
ref/`scrollTo` — check `scrollPosition`/`scrollTargetLayout` in the modifiers before assuming,
but do not grow the scope of this plan for it). So:

- Intent face = lifecycle badge · review **name** · **thesis** card · a `List` of chapters
  (`1. Title`, supporting text = file count) · a final "More files" row when
  `groups.length > 0` (the desktop's synthetic last J/K stop).
- Tapping a chapter pushes `(review)/chapter?index=n`, which shows that chapter's prose,
  diagram/embed, and its file rows, with **Previous / Next chapter** buttons at the bottom
  — J/K, translated. Chapter screens read from the same cached `featureReading` query; they
  take an index, never a copy of the data.
- `prose` is markdown. Phase 1 renders it as **plain text** in `Text` (review prose is
  paragraphs in practice). If markup noise shows up in real reviews, convert to HTML and
  reuse the one sandboxed-HTML component below — do **not** add a native markdown library.
- `diagram` (inline SVG) and `html` embeds render through the **same sandboxed HTML
  component** as Evidence, at `htmlHeight ?? 448` (embeds) / a fixed 320 (diagrams; the
  desktop's aspect-ratio math needs measurement we don't have).
- `canvas.medium === 'html'` renders in that same component. `canvas.medium ===
  'excalidraw'` is **out of scope** — show a one-line "Board canvas — open on the desktop
  app" note. When a canvas *and* a document both exist, show the document and offer the
  canvas below it (no Board/Document toggle chrome on a phone).

### 2.4 Execution — the walkthrough, then a hand-off

Execution face = the agent's `groups` (layer header → files in the agent's order), each row
carrying: path (basename bold, dirname secondary), source marker (`changed` / `context` /
`shipped`), `+adds −dels`, the agent's `note` as supporting text, a **reviewed** checkmark,
and a comment count badge.

- Tap the checkmark → `markReviewed` / `unmarkReviewed` (optimistic, with rollback). A mark
  is not a diff, so it belongs here exactly as on the desktop.
- Tap the row → **cross-tab hand-off**, never an in-tab diff. Hard rule 10: Changes is the
  one home for diffs, Files for source. `source === 'changed'` → the Changes tab's diff
  screen for that path; `context`/`shipped` → the Files tab's file screen. This goes
  through a tiny shared module `src/lib/surface-handoffs.ts` (the mobile analogue of the
  renderer's `lib/surface-handoffs.ts`) exposing `openDiff(path)` / `openFile(path)` that
  push typed hrefs. The targets the sibling plans define: `openDiff` → `02-changes` §2.2's
  `/file?path=<repo-relative>&scope=working` (a query param, because repo-relative paths
  contain `/`); `openFile` → `01-files` §2.1's `/(files)/file/[...path]` (repo-relative
  path **segments**, relativized against `useActiveRepo().path`). If the sibling tab hasn't
  landed its detail route yet, the helper pushes that tab's root — the review slice must
  not care. Whichever of the three worktrees lands first creates the module to this shape;
  the other two only fill in their own target.
- Long-press / trailing "…" opens the row's action sheet: **Comment on this file**, Open
  diff, Mark reviewed. (Use `@expo/ui/swift-ui` `BottomSheet`/`ConfirmationDialog` or a `Stack` formSheet route —
  formSheet preferred, see 2.6.)
- **Why no minimal in-tab viewer:** a phone-sized "just the hunks" panel is precisely the
  second Diff panel rule 10 forbids, and it would immediately want staging, syntax
  colours, and comment anchoring — i.e. a second Changes. The walkthrough's job is the
  *order and the notes*; the diff's home is Changes.

### 2.5 Evidence — checks in-tab, proof on its own screen

Evidence face (in-tab, cheap): title, `updatedAt`, overall status from
`evidenceOverallStatus(checks)` (`fail` wins, else any `pass`, else none), then the checks
list — label, `pass|fail|skip` icon, optional detail. This uses **`loopEvidence` (meta
only)**, never the HTML.

"Open proof" pushes `(review)/evidence`, a full-screen route whose only content is the
sandboxed WebView, `flex: 1` — and **only that screen enables the `loopEvidenceHtml`
query** (up to 4 MB; never fetched while merely browsing the tab, per the payload caution
in `daemon-api.md`). Handle `htmlUnavailable: { reason: 'too-large', bytes, maxBytes }` with
an explicit "Proof is too large for the app — open it on the desktop" state; `null` means
cleared, not an error.

**WebView configuration** (`features/review/sandboxed-html.tsx`, one component used by
Evidence, canvas, embeds and diagrams — mirror of the desktop's single `HtmlView` path,
`src/renderer/src/components/viewer/html-view.tsx`, which is `<iframe srcDoc sandbox="">`):

```tsx
<WebView
  source={{ html }}                       // string source only — never a URL, never a baseUrl
  javaScriptEnabled={false}               // mirrors sandbox="" — no scripts, ever
  originWhitelist={[]}                    // nothing is a permitted navigation target
  onShouldStartLoadWithRequest={allowInitialLoadOnly}
  setSupportMultipleWindows={false}
  allowFileAccess={false}
  allowFileAccessFromFileURLs={false}
  allowUniversalAccessFromFileURLs={false}
  domStorageEnabled={false}
  cacheEnabled={false}
  incognito
  mixedContentMode="never"
  mediaPlaybackRequiresUserAction
  scrollEnabled  // Evidence screen only; embeds/diagrams pass scrollEnabled={false}
/>
```

`allowInitialLoadOnly` permits exactly the first `about:blank` / `data:text/html` load and
returns `false` for everything else — a tapped link inside the proof does nothing (do not
route it to `Linking`; the desktop can't navigate out of `sandbox=""` either).

**Why no network, and the one honest gap.** `loopEvidenceHtml` already inlines every local
asset as a `data:` URL (`src/backend/evidence-assets.ts`: relative `src="…"` inside the
evidence dir → `data:<mime>;base64,…`), so screenshots need zero network. Absolute
`http(s)://` sources are deliberately left alone by the daemon, and the desktop blocks
those anyway because the sandboxed `srcDoc` iframe inherits the renderer CSP (`img-src
'self' data:`). `react-native-webview` cannot filter *subresource* requests without JS, so
to keep the same behaviour we scrub before rendering: `features/review/scrub-remote-assets.ts`
rewrites any non-`data:` `src=`/`srcset=`/CSS `url(` reference in the HTML string to a
`data:` 1×1 placeholder, and the component notes "N remote images blocked". A phone on
cellular must not beacon to a third party because an agent pasted a hotlink.

### 2.6 Comments — file-level first, honestly

The phone has no way to select a line range in a diff it deliberately does not render.
So: **comments anchor to a file** (`addReviewComment { repoPath, path, body }`, no
`startLine`/`endLine`/`anchorText`). That is a first-class desktop shape ("Comment on
file"), not a degraded one. **Later**, once the Changes tab ships a hunk-rendering diff
screen, add per-hunk comments — `startLine`/`endLine` from the hunk's new-file range and
`anchorText` from its first line. Per-line selection on a phone is deliberately deferred.

- **Compose:** `(review)/comment` presented as a **formSheet** (`presentation: 'formSheet'`,
  `sheetAllowedDetents: [0.5, 1]`, `sheetGrabberVisible: true`), taking `?path=`. Body is
  `@expo/ui/swift-ui` `TextField` with `axis="vertical"` + `text={useNativeState('')}` (the prop
  is `text` and takes an `ObservableState`, not a string — see `references/swift-ui.md`). Submit → `addReviewComment`,
  dismiss, invalidate.
- **In context:** each walkthrough row shows its comment count; expanding shows the bodies
  plus any `agentReply` (`{ body, createdAt }`) — the loop visibly closing is the single
  best moment this surface has; do not hide it.
- **The list:** `(review)/comments` — all comments for the repo, grouped by path, resolved
  ones in a collapsed section at the bottom.
- **The human may:** add, edit (`editReviewComment`), delete (`deleteReviewComment`).
  **The human may not resolve.** `resolveReviewComment` is not called from mobile: agents
  resolve once they've addressed the note. Resolved state renders as a badge only.

### 2.7 Board (pushed screen)

Kanban as a phone list: one `List` with three sections in fixed order — **To do · Doing ·
Done** (`CARD_STATUSES = ['todo','doing','done']`) — cards sorted by `order` ascending, as
the daemon returns them.

- Tap a card → `(review)/card?id=` formSheet: title + body `TextField`s, a **status
  `Picker`** (`@expo/ui/swift-ui`; three `Text` children carrying `tag(...)`, styled with the
  `pickerStyle('menu')` modifier — there is no `appearance` prop on this layer), Delete. Save →
  `updateBoardCard` and/or `moveBoardCard`; the daemon re-bumps `order` to `Date.now()` on
  move, so a moved card lands at the end of its column. No drag-reorder (the desktop has
  none either — move is status-only).
- Header "+" toolbar button → the same sheet in create mode → `addBoardCard { title, body?,
  status }`.
- `clearBoardCards` is offered on **Done** only, behind a confirm, matching the desktop's
  done-column-only Clear.
- Deliberately **not** here: "Start Review from a card". Authoring a review set is the
  agent's job; a phone button that writes one would fork the contract.

### 2.8 States

Connection-shaped states are `DaemonGate`'s, not this slice's: wrap each Review/Board screen
body in `<DaemonGate requires="repo">` (00 §2) and write no pairing or repo-picker UI here.

| State | Screen shows |
|---|---|
| No environment paired / token revoked / unreachable | `DaemonGate` — its own empty state and buttons. Never re-detect connection state in this slice |
| Paired, no repo selected | `DaemonGate requires="repo"` → 00's `/repo` sheet |
| Query loading | Native placeholder text; no spinners-in-lists |
| Query error | The daemon error message + Retry (invalidate) |
| `featureView === null` | **Begin-unit** state: "No review yet — this is the start of a unit of work, not a dead end." Board button stays prominent. No Copy-prompt buttons (desktop clipboard affordance) |
| Reading present, thin | "In progress" badge |
| Evidence present / ≥50% reviewed | "Ready to close" badge + hand-off to Changes |
| Evidence absent | Evidence segment disabled |

## 3. Data layer

All procedures below already exist on the daemon; **add none**. Query inputs are the
**absolute daemon repo path string** (from `useActiveRepo()`); mutations take
`{ repoPath, … }`.

Declare each one once with `defineQuery` / `defineMutation` (`src/lib/daemon/procedure.ts`)
in **`src/lib/daemon/procedures/review.ts`** — this slice's own file, with a zod schema for
every output. Never edit `procedures/connection.ts`; there is no barrel, so import the exact
module. The hooks below are thin wrappers over `useDaemonQuery` / `useDaemonMutation`
(00 §2) — they are where this slice's caching policy lives, not a second data layer.

| Hook (`features/review/hooks/`) | Procedure | Options |
|---|---|---|
| `use-feature-view.ts` | `featureView(repoPath)` | `enabled: repoPath !== null`, `staleTime: 0`, `backstopMs: 10_000` while focused |
| `use-feature-reading.ts` | `featureReading(repoPath)` | same; the Intent/Execution source of truth |
| `use-evidence-meta.ts` | `loopEvidence(repoPath)` | `enabled` only, no poll |
| `use-evidence-html.ts` | `loopEvidenceHtml(repoPath)` | **`enabled` only on the `(review)/evidence` screen**, no poll, no retry storm |
| `use-review-comments.ts` | `reviewComments(repoPath)` | `enabled` only; + `addReviewComment` / `editReviewComment` / `deleteReviewComment` mutations |
| `use-reviewed.ts` | `reviewedPaths(repoPath)` | `staleTime: 0`, `backstopMs: 10_000` while focused; optimistic `onMutate` + `cancel()` + rollback around `markReviewed`/`unmarkReviewed` |
| `use-board-cards.ts` | `boardCards(repoPath)` | `enabled` only; + `addBoardCard` / `updateBoardCard` / `moveBoardCard` / `deleteBoardCard` / `clearBoardCards` |

Query keys are fixed by 00: `['daemon', envId, procedureName, input ?? null]`, built by
`daemonKeys`. Invalidate by **procedure name** through `useDaemonInvalidate()` — never a
hand-written key array, and never a tRPC utils proxy (this client is the untyped tRPC client
plus hand-declared descriptors, so no typed utils proxy exists).

**App-event invalidation** (WS `{t:'app-event', event}` from the connection slice). The
routing table is `APP_EVENT_INVALIDATIONS` in `src/lib/daemon/app-events.ts` — the single
append-point all five worktrees share, flat and alphabetical. 00 already seeds every row
this tab needs (mirroring `src/renderer/src/hooks/use-app-events.ts`), so this slice appends
only if it introduces a name that isn't there:

| Event | Invalidate | In 00's seed? |
|---|---|---|
| `feature-view` | `featureView`, `featureReading`, `worktreeInbox` | yes |
| `comments` | `reviewComments` | yes |
| `board` | `boardCards` | yes |
| `evidence` | `loopEvidence`, `loopEvidenceHtml`, `featureReading` | yes |
| `working-tree` | `reviewedPaths` (marks are fingerprinted against HEAD) | yes |

Reconnect does a blanket invalidate — that lives in the connection slice; don't duplicate.

**Polling backstop, phone-shaped.** The desktop polls `featureView`/`featureReading`/
`reviewedPaths` every 3 s. Mobile passes `backstopMs: 10_000` to `useDaemonQuery` on those
three and gates them with `enabled` on screen focus (`useFocusEffect`), because the WS is
the real channel and battery/cellular are real costs. Note 00's `backstopMs` is stricter
than a bare `refetchInterval`: it polls only while the app is foregrounded **and** the
socket is down, so a healthy session polls zero times — which is the intent. Refetch on
screen focus, not window focus. Comments, board and evidence are event-driven +
refetch-on-focus with no interval.

**Mutation fan-out.** Comment mutations invalidate `reviewComments`; board mutations
invalidate `boardCards`; reviewed mutations invalidate `reviewedPaths`. `clearFeatureReview`
and `clearLoopEvidence` are **not** exposed on mobile (see §5).

**Payload caution.** `loopEvidenceHtml` is up to 4 MB of HTML and `featureReading` can carry
~200 files of hunks — mobile never renders those hunks, but it does pay to receive them.
Fetch `featureReading` once per focus cycle, keep it in cache, and derive every chapter and
row from that one object.

## 4. Files to create / change

Create — feature slice `apps/mobile/src/features/review/`:

```
review-screen.tsx           (replace placeholder) faces + segmented switcher + states
face-switcher.tsx           @expo/ui/swift-ui Picker + pickerStyle('segmented')
intent-face.tsx             thesis + chapter outline + canvas note
chapter-screen.tsx          one chapter: prose, diagram/embed, files, prev/next
execution-face.tsx          layer groups, file rows, reviewed toggle, comment badges
file-row.tsx                one walkthrough row + its action sheet trigger
evidence-face.tsx           checks list + "Open proof"
evidence-screen.tsx         full-screen sandboxed WebView
sandboxed-html.tsx          the ONE WebView config (evidence, canvas, embeds, diagrams)
scrub-remote-assets.ts      remote src/url() → placeholder, returns { html, blocked }
lifecycle.ts                reviewLifecyclePhase port + labels
review-outline.ts           outline files, reviewed fraction, chapter list derivation
comment-compose-screen.tsx  formSheet composer
comments-screen.tsx         full comment list
board-screen.tsx            (replace placeholder) grouped list + add
card-screen.tsx             formSheet card editor/creator
hooks/*.ts                  the seven hooks in §3
```

Create — routes `apps/mobile/src/app/(tabs)/(review)/` (thin re-export files only):
`chapter.tsx`, `evidence.tsx`, `comments.tsx`, `comment.tsx`, `card.tsx`.
Change: `(review)/_layout.tsx` — register the new screens; `comment` and `card` get
`presentation: 'formSheet'`, `sheetAllowedDetents: [0.5, 1]`, `sheetGrabberVisible: true`.
`index.tsx` / `board.tsx` already exist and keep their one-line bodies.

Create — the slice's daemon procedure descriptors (its own file, no barrel):
`apps/mobile/src/lib/daemon/procedures/review.ts`.

Shared merge points (coordinate — other worktrees touch these):

- `src/components/toolbar-icon.ts` — a new icon name is one SF Symbol string (iOS-only;
  there is no PNG twin). Existing names: `settings`, `board`, `history` (00 adds
  `repo`). Needed here: `comment`, `add`, `evidence` (or reuse existing). `04-terminal` also
  wants `add` for its roster `+` — first worktree in adds it, the second reuses that exact
  name rather than introducing `plus`/`new`.
- `src/lib/daemon/app-events.ts` — only if this slice introduces a procedure name 00 didn't
  seed (per §3 it doesn't). Keep any append to one flat, alphabetical line.
- `src/lib/surface-handoffs.ts` — **new**, shared with the Changes/Files slices, specified
  here (§2.4) with the concrete route targets those plans define. Whoever lands first
  creates it; keep it to typed `openDiff` / `openFile` href pushes and nothing else.
- `@/lib/daemon/*` — consumed read-only from 00-connection.
- `apps/mobile/README.md` — add the Review routes to the "Where code goes" picture if the
  shape changes.

Docs sync in the same commit (hard rule 4): if anything here proves wrong against the
daemon, fix `apps/mobile/docs/daemon-api.md`; if a decision changes, fix this file.

## 5. Out of scope (deliberately absent)

- **Authoring a review set.** No `review set`-equivalent UI, no "Start Review" from a board
  card, no editing the agent's sections/files/notes. The agent publishes; the human reads.
- **`clearFeatureReview` / `clearLoopEvidence`.** Destructive, cheap to mis-tap on a phone,
  and the desktop + CLI already own the end-of-unit clear.
- **`resolveReviewComment` / `clearResolvedReviewComments`.** Agents resolve.
- **`exploreFeature`.** Comprehension-on-demand is a desktop-sized reading surface; maybe
  later, and only as a read-only reuse of the chapter screen.
- **Excalidraw canvas.** No read-only native renderer exists; show a pointer to the desktop.
- **An in-tab diff or file viewer.** Rule 10 — Changes and Files are the homes.
- **Commit / staging affordances**, including from the "Ready to close" cue.
- **`worktreeInbox`.** Multi-worktree triage is a later, separate surface.
- **Per-line comment anchoring**, drag-reorder on the Board, and markdown rendering of
  `prose` — all named upgrades, none of them phase 1.

## 6. Verification

Static gates (must pass before any commit — hard rule 3 runs `pnpm verify`; the mobile app
is inside `pnpm typecheck` and `scripts/lint-escapes.mjs` scans `apps/mobile/src`):

```bash
pnpm typecheck:mobile        # tsc --noEmit in apps/mobile
pnpm lint                    # biome + lint-escapes (no `as unknown as`, no `void` promise)
pnpm verify                  # the gate
```

Hard-rule reminders for the implementer: no `any`, no `as unknown as` (parse or narrow at
the seam), no `void` on promises, `@expo/ui/swift-ui` only (the universal root is lint-banned),
routes stay one-liners under `src/app`.

Runtime proof — **iOS simulator on the Mac against the dev daemon, never production**
(`serve-sim-remote` skill; full recipe and traps in `README.md` → *Shared verification recipe*):

```bash
pnpm build && pnpm dev:daemon                      # dev daemon on 43118, LAN-bound by default
PORCELAIN_HOME=~/.porcelain-dev PORCELAIN_DAEMON_PORT=43118 \
  node scripts/daemon-cli.js access issue --name "Simulator" \
    --base-url http://<this-host>.local:43118      # LAN URL — the sim is on the Mac, not here
pnpm mobile:start                                  # Metro here; the sim loads the bundle over the LAN
```

Pair the simulator against `http://<this-host>.local:43118` with the link that command prints —
**not** `127.0.0.1`, which on the simulator means the Mac. The `PORCELAIN_HOME` /
`PORCELAIN_DAEMON_PORT` prefix is not optional — without it `daemon-cli.js` reads
`~/.porcelain/admin-token` and issues the link against **production**.
**Port 43117 / `~/.porcelain` is production — do not point the app at it.** First run on a
fresh simulator needs the dev client installed once from the Mac
`eas build -p ios --profile development-simulator` on the host, then `eas build:run -p ios --profile development-simulator --latest` on the Mac, which downloads, installs, and launches it).

Seed a full unit of work on the dev channels (playground repo only):

```bash
pnpm porcelain -- review clear
pnpm porcelain -- review set --name "Review tab" --thesis "…" \
  --files '[{"path":"src/a.ts","source":"changed","note":"the entry point","layer":"Backend"}]' \
  --sections '[{"title":"Why","prose":"…"},{"title":"The shape","prose":"…"}]'
pnpm porcelain -- evidence prepare --title "Loop evidence"   # writes index.html + a screenshot there
pnpm porcelain -- evidence check --label "unit tests" --status pass --detail "42 passed"
pnpm porcelain -- evidence check --label "e2e" --status fail
pnpm porcelain -- board create --title "Follow-up" --status todo
```

Journeys to prove (screenshot each: `python3 ~/.claude/skills/serve-sim-remote/scripts/shot.py e2e/.artifacts/<name>.jpg`,
and delete the artifacts before you stop):

1. **Read Intent** — thesis renders, chapters list, open chapter 2, Next/Previous walk the
   chapters, lifecycle badge reads "In progress" before evidence exists.
2. **Walk Execution** — agent order and notes intact, mark a file reviewed (badge flips to
   "Ready to close" past 50%), tap a `changed` row and land in Changes, not in a second diff.
3. **View Evidence** — checks show pass/fail/skip with the fail-wins overall status; "Open
   proof" renders the HTML with its inlined screenshot; confirm scripts do nothing (seed an
   `index.html` containing `<script>document.body.innerHTML='PWNED'</script>` and prove the
   page is unchanged) and that a hotlinked remote `<img>` is blocked with the count shown.
4. **Comment** — compose on a file from Execution, see it in context and in the list, edit
   it, confirm no Resolve control exists; run `pnpm porcelain -- comments answer --id <id>
   --body "fixed"` and see the agent reply appear via the `comments` app event without a
   manual refresh.
5. **Board** — add a card, move it todo → doing → done, confirm it lands at the end of its
   column, delete it.
6. **Live updates** — with the app open, run `pnpm porcelain -- review add --files '[…]'`
   and confirm the walkthrough updates from the WS event (not only after 10 s).
7. **States** — un-pair (or stop the daemon) and confirm the no-environment / error states,
   then `pnpm porcelain -- review clear` and confirm the begin-unit empty state.

Publish the Review for this work with those screenshots as evidence (`close-the-loop`).

## 7. Worktree notes

- Slug: `pnpm worktree create mobile-review` → branch `work/mobile-review`, isolated dev
  daemon in 43200–43999 (use **that** port in place of 43118 in §6), per-slug channels and
  playground.
- **Start after `00-connection` merges to `main`** — this plan has no fallback client and
  must not stub one. Rebase on `main` first; if the daemon seam's names differ from
  `@/lib/daemon/…` above, adapt to what merged.
- Only three files outside the review slice and its routes are expected to change or appear:
  `src/components/toolbar-icon.ts`, `src/lib/surface-handoffs.ts`, and this
  slice's own `src/lib/daemon/procedures/review.ts` (plus a one-line append to
  `src/lib/daemon/app-events.ts` if — and only if — a procedure name 00 didn't seed shows
  up). If a fourth shared file starts changing, stop and reconsider — that is the signal a
  second architecture is being forked.
- PR into `main` with the Review's evidence attached, squash-merge, then
  `pnpm worktree remove mobile-review`. Leave no `test-results/`, `.playwright-mcp/`, or
  scratch behind.
