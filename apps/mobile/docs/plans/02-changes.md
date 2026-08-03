# Plan 02 — Changes (with History) on the native client

Status: implemented, with the contextual shell and quick-command expansion tracked below. Depends on **plan 00-connection** (daemon client/session/query seams under `apps/mobile/src/lib/daemon/`).

## 1. Mission

Make the phone the place where you *read what the agent did and decide it's good* — Changes is the canonical home for diffs, staging, and commit on every Porcelain client, and on mobile it has to carry that identity in a thumb-sized surface. The tab opens on the working tree **grouped by flow layer** (never alphabetically — that grouping is the product's differentiator, not a sort option), lets you read the whole change as one continuous scrolling document (`diffReading`), mark files reviewed, stage what belongs together, and commit with the repo's own conventional vocabulary. History is the same story one step back: a `gitLog` list pushed from the Changes header, and a commit detail that reuses the *identical* flow-grouped list and diff reader with a commit scope. No second diff renderer or second commit UX; project, branch, and worktree selection live together in the shared native context header, while branch-diff review remains out of scope for the phone list.

## 2. UX shape

All UI is `@expo/ui/swift-ui` (`Host`, `List`, `Section`, `VStack`, `HStack`, `Text`, `Toggle`, `Button`, `Picker`, `TextField`, `Spacer`, `Image`, `ScrollView`, `ConfirmationDialog`) with styling from `@expo/ui/swift-ui/modifiers`, plus Expo Router (`Stack`, `Stack.Toolbar`, `Link`, `router`). The universal `@expo/ui` root is **lint-banned** (rule 5) — `pnpm lint` fails on a bare `from '@expo/ui'`. No shadcn, no Tailwind, no DOM components. One note on loading: `ActivityIndicator`/`RefreshControl` are **not** used — use the `refreshable` modifier on `List`, and text rows for loading states (§2.6). Do not add a spinner library.

### 2.1 Working-tree list (`index`, the tab home)

Source of truth is **`gitFlow`** alone — it returns `FlowGroup[] = { layer, files: FlowFile[] }[]` where each `FlowFile` already carries `path`, `status`, `staged?`, `unstaged?`, `additions?`, `deletions?`, `connects[]`. Do **not** also fetch `gitStatus` for the list; it's the same data minus grouping and stats. (`gitStatus` may be used later for a cheap dirty/clean probe elsewhere; not here.)

Layout, top to bottom, inside one `Host style={{flex:1}}` + `List` (native `List` = SwiftUI `List`, so it virtualizes):

1. **Summary row** — `<branch> · N files · +A −D · M reviewed`. Branch from `gitHead` (`headLabel`-equivalent: branch name, else `detached @ sha`). Project, branch, and worktree are selected from the shared header; the summary does not duplicate those controls.
2. **Suggestion strip** (when `gitSuggestions` returns any whitelisted command) — each row carries the command's `reason` and runs through the same command surface as the desktop. **Note:** `gitSuggestions` is *quick-command* advice derived from branch-sync + stash state — it is **not** commit-message suggestion. Commit-message help comes from `gitCommitConventions`. The desktop code (`src/backend/search/suggestions.ts`) is authoritative here; don't wire it into the composer.
3. **One section per layer, in `gitFlow` order** — a plain section-header row (`Text`, uppercase, secondary color) `LAYER · n files · +A −D · k/n reviewed`, then that group's file rows. Layer order comes from the daemon and is never re-sorted client-side; files inside a group keep daemon order too. A repo on starter layers will show most files under `Other` — that's correct and expected, don't "fix" it by sorting.
4. **File row** (`ListItem`):
   - `leading`: a status glyph — `Icon` with a per-status SF Symbol / material symbol (`plus.circle` added, `pencil.circle` modified, `minus.circle` deleted, `arrow.triangle.turn.up.right.circle` renamed, `questionmark.circle` untracked), tinted from `theme/colors`.
   - headline: the **basename**, `numberOfLines={1}`; `supportingText`: the dirname (truncated head-first is not available — use `numberOfLines={1}`, the tail matters less than the file name here), plus `+A −D`.
   - `trailing`: a `Row` of (a) a reviewed check glyph — filled `checkmark.circle.fill` when the path is in `reviewedPaths`, hidden otherwise (display only, toggled from the diff screens, §2.3); (b) a `Checkbox` bound to "fully staged" (`staged && !unstaged`), the staging control (§2.4).
   - `onPress` opens the **file diff** screen (`/file?path=…`). Row tap = read, checkbox = stage: two targets, no gesture vocabulary to learn.
5. Header toolbar (`Stack.Toolbar placement="right"`, existing pattern in `changes-screen.tsx`): **History** (always available) and the bolt sheet. Read and agent Review are contextual rows in the Changes list. The bolt sheet carries the desktop command set plus staging, review marks, and commit.

Pull-to-refresh via `List`'s `onRefresh` → refetch `gitFlow` + `reviewedPaths`.

### 2.2 Reading the change — `diffReading` is the primary, `gitDiffFile` the secondary

**Decision: `diffReading` (scope `working`) is the phone's primary read mode; per-file `gitDiffFile` is the secondary, focused mode.** A phone is a scroll surface: one continuous flow-ordered document ("Read") lets you consume a whole agent change with a thumb, in the exact order the desktop Review teaches, in **one** request instead of N round-trips over LAN/tailnet. Tapping an individual file is the escape hatch for "I only care about this one", and the required fallback when the change is too big to inline (§3). The list stays the tab's home — `diffReading` is heavy and must never fire on tab open.

**Decision: render diffs as native text rows. No WebView. No syntax highlighting in v1.**

- A WebView would buy CSS control and highlighting, but it is a DOM surface — against hard rule 5 and the `mobile` skill for ordinary UI — and it would duplicate theming, break native scroll/handoff into the stack, and put the app's core reading surface outside the native toolkit. `react-native-webview` stays reserved for the two places the app can't render natively at all: daemon-authored HTML we don't own (`loopEvidenceHtml`, `03-review` §2.5) and the terminal emulator (`04-terminal` §2.1, a decision that plan records in the architecture skill). A diff is not one of those.
- Syntax highlighting is deferred, **not blocked**. The original reason was that universal `@expo/ui` `Text` takes `children?: string`, so per-token coloring was impossible; `@expo/ui/swift-ui` `Text` takes `React.ReactNode` and documents nested `Text` spans, which is the SwiftUI-native way to do it. What still costs is the rest: a tokenizer, a theme, and N span nodes per line crossing the bridge on the app's longest screen. T3 Code needed a custom shiki engine to do this well; we're not paying that for v1 — but record it as a cost decision, not an API limit, so v2 doesn't re-derive a wrong reason. Diff legibility on a phone comes from the three things we *can* do natively: monospace (`textStyle.fontFamily`: `Menlo` — one helper in `theme/`), a per-line background tint for add/del, and a compact line-number gutter.
- Line rendering: one `Row` per diff line = `Text` gutter (old/new line number, fixed width, secondary) + `Text` content (`numberOfLines={1}`, `fontSize` 12, monospace). **Unified diff only, no side-by-side, no intra-line word diff.** Long lines truncate rather than wrap — a horizontally scrolling nested `ScrollView` per line is a performance trap; a single truncated line with the option to open the file is the phone-correct tradeoff.

**Reading screen (`/reading?scope=working` | `?scope=commit&hash=…`)**: flatten `FeatureReading` (`{ name, groups: { layer, files: ReadingFile[] }[] }`, each `ReadingFile` carrying `path`, `status`, `additions/deletions`, `hunks?: DiffHunk[]`) into **one precomputed flat row array** (`lib/diff-rows.ts`) — `layer-header | file-header | hunk-header | line | file-footer | truncation-notice` — and feed it to a single virtualized `List`. Never nest a `List` inside a `List`. Row identity is a stable string key (`${path}:${hunkIndex}:${lineIndex}`).

Caps (non-negotiable — the daemon builds up to 200 files of hunks):
- Per file, render at most **300 lines**; beyond that emit a `truncation-notice` row: "+N more lines — Open file" → the file diff screen.
- Whole-document guard: if the flattened row count would exceed **6000**, render only the first files up to that budget and end with "Change too large to read inline — open files individually", which returns focus to the list. (`FeatureReading.sections` is empty for `diffReading` — that field belongs to the Review tab; ignore it here.)
- A file `footer` row carries **Mark reviewed / Reviewed** (toggles `markReviewed` / `unmarkReviewed`) — the review loop is the point of reading, and it's one mutation.
- Files with no `hunks` (binary, image, vanished) render a single "Binary or unreadable — not shown" row. No image previews in v1 — `@expo/ui/swift-ui` does have `Image`, so this is a scope call (a diff is text; an image diff is its own design), not a missing primitive.

**File diff screen (`/file?path=…&scope=working|commit&hash=…`)**: `gitDiffFile` (working) or `gitCommitDiff` (commit) → `{ hunks, status, image?, binary? }`, same row renderer, plus a header toolbar with **Mark reviewed** (working scope only), **Stage/Unstage** (working scope only), and **Discard** (working scope only, destructive, §2.4). Path is passed as a **query param, never a dynamic segment** — repo-relative paths contain `/` and would shred a `[path]` route.

### 2.3 Reviewed marks

`reviewedPaths` (a `string[]` of repo-relative paths) is fetched alongside `gitFlow` and rendered as the check glyph on rows and the footer state in the reader. Toggle points: the file diff screen toolbar and the reading screen's per-file footer — **not** the list row (its two targets are already spoken for). Mutations are optimistic (flip a local set, invalidate on settle); the daemon re-fingerprints and prunes stale marks on the next `reviewedPaths` read, so treat the server's answer as authoritative on refetch. `gitCommit` clears the marks for committed paths server-side — invalidate `reviewedPaths` after commit (see §3).

### 2.4 Staging and discard

- **Stage/unstage: the row's trailing `Toggle`.** Decision, and the reason: `@expo/ui/swift-ui` *does* ship `SwipeActions` and `ContextMenu`, so this is a design call, not an API limit — a gesture is invisible, and this is the app's most-used control. A visible toggle is visible, discoverable, and honest about the tri-state: checked = fully staged, unchecked = nothing staged, **partial** (`staged && unstaged`) renders as a checked box with a "partly staged" supporting note; tapping it stages the rest. No hunk-level staging (§5).
- `gitStageFile` / `gitUnstageFile` are optimistic on the row, then invalidate `gitFlow`.
- **Stage all / Unstage all** in the bottom toolbar (`gitStageAll` / `gitUnstageAll`).
- **Discard** lives only on the file diff screen (never on a list row — an accidental tap must not destroy work), behind `Alert.alert('Discard changes to <basename>?', …, [{style:'destructive'}])`. On success: invalidate `gitFlow` + the file's diff + `diffReading`, then `router.back()` — the screen's subject no longer exists. (The daemon reverts a tracked file to HEAD and *trashes* an untracked one; say so in the confirm body: "Tracked files revert to HEAD; new files move to the Trash.")

### 2.5 Commit composer

A route presented as a **form sheet** (`presentation: 'formSheet'`, `sheetAllowedDetents: [0.6, 1.0]`, `sheetGrabberVisible: true`) inside the Changes stack, matching the existing Settings sheet idiom in `src/app/_layout.tsx`. Contents:

1. Staged summary: "N files staged · +A −D" and a warning line when unstaged files remain.
2. **Type** and **Scope** `Picker`s fed by `gitCommitConventions` → `{ types, scopes }` (learned from the repo's last 200 subjects, `DEFAULT_COMMIT_TYPES` fallback). Selecting rewrites the message's `type(scope): ` prefix; the message stays the source of truth, and a freeform message with no prefix commits fine. Port the ~25-line prefix parse/apply into `features/changes/lib/commit-message.ts` — the desktop's `src/renderer/src/lib/commit-message.ts` is renderer-scoped and must not be imported across the app boundary; keep the behavior identical (same architecture, separate client).
3. **Message** — `@expo/ui/swift-ui` `TextField` with `axis="vertical"` for multiline and `text={useNativeState('')}` (the prop is `text` and takes an `ObservableState`, *not* a string; `react-native-worklets` is already a dependency). `useNativeState` is re-exported from `@expo/ui/swift-ui`.
4. **Commit** button: disabled while the message trims to empty, the tree is clean, or the mutation is pending. Errors render inline as monospace text (git's own output) — never a toast that scrolls away.
5. Draft survives navigation within the session, keyed by repo path, in a module-level store inside the slice. 00-connection lands **zustand** (its environments store), so follow that convention rather than inventing a second one — and don't add any *other* state library.

**Push** is out of the composer (the desktop deliberately keeps Push out of Commit too). It is a single explicit tap in the suggestion strip → `Alert.alert` confirm → `gitPush` → invalidate `gitSuggestions` + `gitHead`, with git's output shown inline on failure.

**Scope of commit UX in v1: staging toggles + stage-all + conventional-prefix pickers + message + commit + discard (confirmed) + push (confirmed).** The bolt sheet also exposes the desktop's six quick commands. Out: amend, hunk staging, co-authors, and commit templates.

### 2.6 History (pushed from the Changes header)

- **`/history`** — `gitLog({ repoPath, limit })`, `limit` starting at 100, with a footer row "Load 100 more" stepping to the 500 cap (there is no cursor API; a bigger `limit` refetch is the whole story). Rows: subject (1 line), `author · relative date` supporting text, short hash trailing (monospace). Pull-to-refresh. Tap → `/commit/[hash]`.
- **`/commit/[hash]`** — header: `gitCommitMessage` (subject bold, body as secondary text, selectable-ish `Text`), short hash, author/date from the log row (pass via route params to avoid a second query; fall back to `gitLog` cache). Body: **the same `FlowGroupList` component** rendered from `gitCommitFlow` — flow order for a historical commit is the same identity. Toolbar: **Read** → `/reading?scope=commit&hash=…` (`diffReading` with commit scope). File tap → `/file?path=…&scope=commit&hash=…` (`gitCommitDiff`). No staging, reviewed, or discard affordances in commit scope — the same components take a `scope` prop and hide them.
- Commit hashes are immutable and the daemon caches their flow forever: use `staleTime: Infinity` for `gitCommitFlow` / `gitCommitDiff` / `gitCommitMessage` / commit-scoped `diffReading`. Never poll them.

### 2.7 Empty and degraded states

Connection-shaped states are **not this slice's** to write: every Changes screen body sits inside `<DaemonGate requires="repo">` (00 §2, `src/components/daemon-gate.tsx`), which owns the pair / re-pair / unreachable / choose-a-repo states and their buttons. For the states below that *are* ours, reuse `components/empty-state.tsx` (00 lands it) or the existing `components/placeholder-screen.tsx` rather than inventing a third empty-state component.

| State | Surface |
|---|---|
| No environment paired / not connected / token revoked | `DaemonGate` — nothing to build here. |
| No repo selected | `DaemonGate requires="repo"` → 00's `/repo` sheet. Do not build a second picker here. |
| Clean tree | "Working tree clean." + the last commit's subject (from `gitLog` limit 1) + "View history". Bottom-toolbar actions disabled, not hidden. |
| Empty history | "No commits yet." |
| Query error | Message + **Retry** (refetch). Show the daemon's message verbatim; a contract mismatch is an `invalid-response` error per `daemon-api.md`. |
| Large change | §2.2 guard rows. |

## 3. Data layer

**Seam.** All server access goes through the daemon seams plan 00-connection defines in its §2 under `src/lib/daemon/`. Those names are binding — use them, don't paraphrase them:

- Declare every procedure this slice calls once, with `defineQuery` / `defineMutation` (`src/lib/daemon/procedure.ts`), in **`src/lib/daemon/procedures/changes.ts`** — this slice's own file. Never edit `procedures/connection.ts`; there is no barrel, so import from the exact module.
- Read data with `useDaemonQuery(descriptor, input, { enabled, staleTime, backstopMs })`, write with `useDaemonMutation(descriptor, { invalidates })`, and invalidate imperatively with `useDaemonInvalidate()`.
- The active repo comes from `useActiveRepo()`, the environment from `useActiveEnvironment()`, connection state from `useConnectionState()`, and the WS from `useDaemonSession()`.
- This slice **must not**: construct a tRPC client, read `expo-secure-store` directly, hardcode a base URL, or open its own WebSocket.

Every descriptor carries a zod schema for its **output** (inputs are ours, so they aren't parsed) — that is what turns contract drift into a legible `invalid-response` error instead of an undefined-property crash mid-scroll.

**Queries** (all inputs are daemon-side paths; `repoPath` is the active repo):

| Query | Input | Used by | Caching |
|---|---|---|---|
| `gitFlow` | `repoPath` | working-tree list | `backstopMs: 10_000`, event-invalidated |
| `reviewedPaths` | `repoPath` | check glyphs | with `gitFlow` |
| `gitHead` | `repoPath` | summary row | `staleTime` 30 s |
| `gitSuggestions` | `repoPath` | contextual suggestions in the bolt sheet | `staleTime` 30 s |
| `featureView` | `repoPath` | contextual Review row in Changes | focused poll / event-invalidated |
| `gitCommitConventions` | `repoPath` | composer pickers | `staleTime` 5 min; only when the sheet is open |
| `diffReading` | `{repoPath, scope:{type:'working'}}` | reading screen | **no polling**, `enabled` only while that screen is mounted+focused |
| `gitDiffFile` | `{repoPath, filePath}` | file diff (working) | `staleTime` 0, event-invalidated |
| `gitLog` | `{repoPath, limit}` | history | `staleTime` 30 s |
| `gitCommitFlow` / `gitCommitDiff` / `gitCommitMessage` / `diffReading{commit}` | `+hash` | commit detail | `staleTime: Infinity` |

**Keys.** The key is fixed by 00: `['daemon', envId, procedureName, input ?? null]`, built by `daemonKeys` — never a hand-written array, and never a tRPC `queryOptions`/utils proxy (this client is the untyped tRPC client plus hand-declared descriptors, so no typed utils proxy exists). The environment id is already in the key, and `repoPath` (plus `hash` where relevant) rides along inside `input`, so switching repo or environment can never show another repo's diff.

**Invalidation.** Mirror the desktop's `src/renderer/src/hooks/use-commit.ts` sets — this is the one architecture, not a fresh design. App-event → procedure-name routing lives in **`src/lib/daemon/app-events.ts`** (`APP_EVENT_INVALIDATIONS`), the single append-point all five worktrees share; keep it flat and alphabetical:

- WS `app-event` `working-tree` → `gitStatus`, `gitFlow`, `gitRangeFlow`, `diffReading`, `gitDiffFile`, `reviewedPaths`, `gitHead` — **already seeded by 00**, so this slice appends nothing unless it introduces a new name. (This event is only delivered to sessions that registered watches — the connection slice owns `session:hello` + `watch:dirs` and re-registers on every reconnect.)
- stage / unstage / stage-all / unstage-all → `gitFlow`.
- `gitDiscardFile` → `gitFlow`, `gitDiffFile`, working `diffReading` (+ `router.back()`).
- `gitCommit` → `gitFlow`, `gitLog`, `gitCommitConventions`, `gitSuggestions`, `reviewedPaths`, working `diffReading`; clear the draft; close the sheet.
- `gitPush` → `gitSuggestions`, `gitHead`.
- `markReviewed` / `unmarkReviewed` → `reviewedPaths` (optimistic first).

**Focused-poll backstop.** The desktop polls `gitFlow`/`reviewedPaths`/`diffReading` every 3 s. Mobile passes `backstopMs: 10_000` to `useDaemonQuery` on **`gitFlow` + `reviewedPaths` only**, and gates them with `enabled` on screen focus (`useFocusEffect`/`useIsFocused`); everything else is event- or manual-refresh-driven. Note what 00's `backstopMs` means, because it's stricter than a plain `refetchInterval`: it polls only while the app is foregrounded **and** the `/session` socket is down. A healthy socket means zero polling — which is exactly the intent here (battery and cellular; the WS event is the real signal, the poll is belt-and-braces for a dropped socket).

**Payload cautions.** `diffReading` can carry ~200 files of hunks in a single JSON response; that is the heaviest call this client makes. Therefore: never prefetch it, never poll it, gate it behind the explicit **Read** tap, apply the §2.2 caps at the *render* layer (the payload still arrives — a future daemon-side cap is out of scope), and before firing it check the `gitFlow` totals: if `files > 60` or `additions+deletions > 4000`, show a "Large change — read file by file / Load anyway" interstitial instead of auto-fetching. `gitCommitDiff` and `gitDiffFile` stay cheap; prefer them whenever a single file is the subject.

**No `void` on promises, no `any`, no `as unknown as`** (hard rules 6/7; `scripts/lint-escapes.mjs` scans `apps/mobile/src`). Mutations are `await`ed inside `async` handlers; where a handler genuinely doesn't need the result, call it bare without `void`.

## 4. Files to create / change

Create — feature slice:

```
apps/mobile/src/features/changes/
  changes-screen.tsx              (REWRITE — working-tree list, toolbars, empty states)
  history-screen.tsx              (REWRITE — gitLog list)
  commit-detail-screen.tsx        gitCommitMessage + gitCommitFlow via FlowGroupList
  reading-screen.tsx              diffReading, scope-parameterized
  file-diff-screen.tsx            gitDiffFile / gitCommitDiff, scope-parameterized
  commit-sheet-screen.tsx         the composer
  components/flow-group-list.tsx  layer sections + rows (shared by working + commit scope)
  components/change-row.tsx       status glyph · name · stats · reviewed check · stage checkbox
  components/diff-rows-view.tsx   the one diff renderer (flat row array → List)
  components/summary-row.tsx      branch · counts · push suggestion strip
  data/queries.ts                 useDaemonQuery wrappers over the procedures/changes.ts descriptors
  data/mutations.ts               staging/commit/discard/push/reviewed + invalidation sets
  lib/diff-rows.ts                FeatureReading|DiffHunk[] → flat row model + caps (pure)
  lib/commit-message.ts           conventional prefix parse/apply (local port)
  lib/scope.ts                    DiffScope type + route-param encode/decode
  lib/status.ts                   FileStatus → icon name + tint
```

Create — routes (thin re-export files only, `src/app` holds no logic):

```
apps/mobile/src/app/(tabs)/(changes)/reading.tsx
apps/mobile/src/app/(tabs)/(changes)/file.tsx
apps/mobile/src/app/(tabs)/(changes)/commit-sheet.tsx     (form sheet)
apps/mobile/src/app/(tabs)/(changes)/commit/[hash].tsx
```

Create — the slice's daemon procedure descriptors (its own file, no barrel):

```
apps/mobile/src/lib/daemon/procedures/changes.ts
```

Change:

- `apps/mobile/src/app/(tabs)/(changes)/_layout.tsx` — register the four new screens; titles (`Read`, file basename, `Commit`, short hash); `presentation: 'formSheet'` + detents for `commit-sheet`, matching the root layout's sheet options.
- `apps/mobile/src/app/(tabs)/(changes)/index.tsx`, `history.tsx` — unchanged one-line re-exports.
- `apps/mobile/src/components/toolbar-icon.ts` — add `read`, `reviewed`, `stage`, `discard`, `push` to `ToolbarIconName` and `SF_SYMBOLS`. iOS-only, so a symbol string is the whole entry — no raster twin.
- `apps/mobile/src/theme/colors.ts` — add the diff/status palette (`addBg`, `delBg`, `gutter`, `secondaryText`, per-status tints) and the monospace family helper. One home; no hex literals in components.
- `.agents/skills/mobile/reference/client.md` — replace the Changes placeholder description with what the tab now is (list → read → stage → commit → history), including the "diffs are native text, no highlighting in v1" decision.
- `apps/mobile/docs/daemon-api.md` — only if implementation proves a documented shape wrong (the code wins; fix the doc in the same commit).

- `apps/mobile/src/lib/daemon/app-events.ts` — only if this slice introduces a procedure name 00 didn't seed. The `working-tree` row already lists everything in §3; keep any append to one flat, alphabetical line.
- `apps/mobile/src/lib/surface-handoffs.ts` — the shared module `03-review.md` §2.4 specifies (typed `openDiff` / `openFile` pushes). **Changes owns the `openDiff` target**: `openDiff(path)` pushes this slice's `/file?path=<repo-relative>&scope=working` route. Whichever worktree lands first creates the module to 03's shape; until this slice's route exists it falls back to the Changes tab root.

Merge points shared with sibling mobile worktrees (expect conflicts, keep diffs surgical): `toolbar-icon.ts` (+ `assets/toolbar/*.png`), `theme/colors.ts`, `README.md`, `(tabs)/(changes)/_layout.tsx`, `lib/daemon/app-events.ts`, `lib/surface-handoffs.ts`.

Do **not** touch: anything under the repo-root `src/` (Electron/daemon), `src/renderer/**` helpers (re-implement locally instead of cross-importing), or the connection slice's files.

## 5. Out of scope for phone v1

Named on purpose, so nobody "completes" the surface:

- **Branch scope.** Changes is working-scope only; History is commit-scope. No `gitRangeFlow` / "vs main" toggle — the branch story belongs to the Review/PR, and a scope switcher on a phone list is noise.
- **Workspace selection.** The shared context header exposes the active project, branch, and linked worktree. Branch checkout and worktree switching are supported because they answer "which checkout am I reviewing?"; branch creation, worktree creation, and the worktree inbox remain out of scope for the phone.
- **Quick commands**: the Changes bolt owns the daemon whitelist (`status`, `pull`, `push`, `fetch`, `stash`, `stash-pop`).
- **Hunk-level / line-level staging**, amend, revert, cherry-pick, commit context menu.
- **Syntax highlighting, split diff, word-level intra-line diff, in-diff search, image/binary previews.**
- **File history** (`gitFileLog`), blame.
- **Review comments** (`addReviewComment` & co.) — the Review tab owns those; Changes may later hand off, not host.
- **Layer configuration** (`repoLayers`/`setRepoLayers`) — layers are agent- or desktop-managed; the phone consumes the order.
- Daemon-side payload caps for `diffReading` (client-side render caps only).

## 6. Verification

Static (must pass before any commit — hard rule 3 runs the whole thing):

```bash
pnpm --dir apps/mobile typecheck     # or: pnpm typecheck:mobile
pnpm lint                            # biome + lint-escapes (scans apps/mobile/src)
pnpm verify                          # lint + test + build — the commit gate
```

**Do not** add vitest/jest to the `apps/mobile` package. 00-connection extends the **root** vitest `include` to `apps/mobile/src/**/*.test.ts`, so the pure modules (`lib/diff-rows.ts`, `lib/commit-message.ts`) can carry small tests under the root runner — keep react-native and `expo-*` imports out of them, which is what makes them testable. Everything else is proved by the runtime journey below.

Runtime — **iOS simulator on the Mac**, driven from here over the LAN (`serve-sim-remote` skill), against the **development** daemon — never production 43117. Full recipe and traps: `README.md` → *Shared verification recipe*.

```bash
pnpm build && pnpm dev:daemon                      # dev daemon on 43118, LAN-bound by default
PORCELAIN_HOME=~/.porcelain-dev PORCELAIN_DAEMON_PORT=43118 \
  node scripts/daemon-cli.js access issue --name "Simulator" \
    --base-url http://<this-host>.local:43118      # LAN URL — the sim is on the Mac, not here
pnpm mobile:start                                  # Metro here; the sim loads the bundle over the LAN
```

The `PORCELAIN_HOME` / `PORCELAIN_DAEMON_PORT` prefix is not optional — without it `daemon-cli.js` reads the production admin token and issues a link against 43117. In a managed worktree, substitute its own 43200–43999 port everywhere 43118 appears. First run on a fresh simulator needs the dev client installed once from the Mac (`eas build -p ios --profile development-simulator`, then `xcrun simctl install booted <App>.app`).

Pair the simulator to `http://<this-host>.local:43118` using the environment-group flow from 00-connection (Settings → Environments → Pair an environment group → paste the printed link) — **not** `127.0.0.1`, which on the simulator means the Mac. Point it at a **playground** repo (`~/code/porcelain-playgrounds/<slug>`), never a real worktree.

Fixture: make the playground dirty across at least two layers — e.g. edit `README.md` (Docs) and `src/example.ts` (Other) and add one new file — so grouping, statuses, and stats are all visible.

Journeys (each is a screenshot for the Review's evidence; `python3 ~/.claude/skills/serve-sim-remote/scripts/shot.py shot.jpg`):

1. **Grouped list** — dirty playground → Changes shows layer sections in daemon order (not alphabetical), correct statuses, `+A −D`, staged/unstaged checkbox states.
2. **Read the change** — tap Read → one continuous scroll through every file's hunks in the same flow order; monospace, add/del tinting, line numbers; per-file Mark reviewed toggles and the check appears on the list row after going back.
3. **Focused diff** — tap a file row → its diff only; Stage from the toolbar; back → the row's checkbox is checked and `gitFlow` reflects it.
4. **Commit** — Commit sheet → pick a type/scope from the repo's learned vocabulary → type a subject → Commit → sheet closes, list goes clean-tree, reviewed checks are gone.
5. **History** — History → the new commit is the top row → open it → flow-grouped file list → Read shows the commit's diff, a file opens its commit diff.
6. **Guards** — discard confirm (cancel and confirm), push confirm, clean-tree empty state, large-change interstitial (generate a wide change to trip it), airplane-mode/daemon-down error + Retry.
7. **Live update** — with Changes open, edit a file on the host: the list updates from the `working-tree` app-event within a second (kill the WS to confirm the 10 s `backstopMs` poll then takes over and still catches it).

If the Mac is unreachable, say so in the Review and mark the runtime journeys unproved — there is no second platform to fall back to any more, so do not claim a flow works off the static gate alone.

Close the loop: publish a Review (Intent · Execution · Evidence) with these screenshots attached before the commit lands, per `close-the-loop`.

## 7. Worktree notes

- Slug: **`mobile-changes`** — `pnpm worktree create mobile-changes` → `work/mobile-changes` + isolated daemon port (43200–43999, printed by the tool) + `~/code/porcelain-playgrounds/mobile-changes`. Use that port everywhere 43118 appears above.
- **Start only after `00-connection` merges into `main`**, then `git pull --ff-only` before creating the worktree (or rebase the worktree onto main). This slice consumes the daemon client/query/app-event seams; building against a guessed API means a rewrite.
- Touch only the changes slice, its routes, and the four named merge points. If a needed primitive is genuinely missing from `@expo/ui/swift-ui`, do **not** hand-roll it — rule 5 gaps need the human's approval; raise it instead of inventing one. Check the installed `.d.ts` first: the SwiftUI layer has 51 components and ~140 modifiers, so "missing" is usually "not looked up".
- Finish with `pnpm verify`, PR into `main` with the Review's evidence attached, squash-merge, then `pnpm worktree remove mobile-changes`. Delete session debris (`.playwright-mcp/`, `test-results/`, screenshots you didn't attach) before you stop.
