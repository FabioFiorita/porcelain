# Mobile quick open — one jump surface, and it is not a second search

**Plan.** Written 2026-08-08. Not started. Trigger: a consistency audit found
`SearchCommandSheet` shipping hardcoded fixtures to production tablets — six fake file paths,
three fake saved actions, three fake commits, every row's `onPress` a bare `onClose()`. This
plan turns the mock into the feature it is pretending to be, or deletes it.

## What is there now (verified on main, file:line)

- `apps/mobile/src/features/shell/shell-sheets.tsx:177-310` — `SearchCommandSheet`, a `bare
  hideHeader` `ShellModal` with an `Input` (`autoFocus={open}`, `returnKeyType="search"`,
  placeholder "Search files, folders, commands, commits…") over a `ScrollView` of three
  `CommandGroup`s: **Files · Commands · Commits**. The arrays are literals (`'a3f2c01'` /
  `'Shell: tablet SplitView POC'`), filtered client-side by `includes`. No daemon call, no
  hook, no `testID` on anything — not the input, not a row, not the empty state, which is a
  bare `Text` where the house idiom is `EmptyNote`.
- `apps/mobile/src/features/shell/tablet-header.tsx:33-45` — the only entry point:
  `openSheet('search')` from a centered `Pressable` (`testID="porcelain-tablet-search"`) styled
  as a search field, absolutely positioned at true window center. **Tablet only.** The phone
  header (`phone-header.tsx`) has no search affordance, and there is no key handler anywhere in
  the mobile app — no ⌘K, no ⌘P.
- No `__DEV__` guard, no flag, no env check on that path. `_layout.tsx:39` → `TabletShell` →
  `TabletHeader` → sheet. Any iPad build, including a TestFlight one, ships it.

The real search already exists and is good: `features/files/search-panel.tsx` (369 lines,
fifteen testIDs, `SegmentedControl` text/files, case + regex + include/exclude filters, 150 ms
debounce, `EmptyNote` idle state) backed by `useFileSearch`/`useCodeSearch` in `use-files.ts`,
rendering content hits through `content-results.tsx`. It is a **tab** (`app/search.tsx` →
`surface-slots.tsx:79`) and also a **face of the Files tab** (`tab-faces.ts`, re-tap to toggle).

So mobile has a search product. What it does not have is what the sheet is drawn as.

## The position: quick open is navigation, not search

Take the unified surface — but scope it as **jump**, not **explore**, and say so in the copy.

The argument against a unified sheet is that mobile already searches, and a second search
surface is exactly the "second architecture" failure: two ranking rules, two debounce constants,
two empty states, two places to fix a bug. That argument is correct about *content* search and
wrong about *navigation*. They answer different questions:

| Question | Surface | Shape |
|---|---|---|
| "Where does this string appear?" | Search tab / Files face | A result set you dwell in — filters, groups, context lines, recent searches |
| "Take me to the thing I can already name." | This sheet | One line of input, a handful of rows, gone in two taps |

The second question has no answer on mobile today. On a phone that is worse than on desktop,
not better: reaching `apps/mobile/src/features/shell/shell-sheets.tsx` means Files tab, then
five folder taps, or Search face → files mode → type → tap → back out of a screen you did not
want to be in. The Search tab is a place you *go*; quick open is a thing you *do* from wherever
you are.

The shape is not ours to invent, either — **`apps/web` already shipped it**, and the mock is a
tracing of it. `apps/web/src/components/shell/file-finder.tsx` is a cmdk dialog on ⌘P/⌘K with
precisely three groups: files from `useFileSearch`, saved commands from `useActions`, commits
from `useGitLog(200, open)`. Its two ranking rules are already written, commented, and small
enough to port verbatim:

```ts
const SHA_QUERY = /^[0-9a-f]{7,40}$/i
function matchCommands(query, actions)  // title|command substring, slice(0, 5)
function matchCommits(query, commits)   // hash.startsWith(q) when SHA-shaped, slice(0, 5)
```

Porting those keeps one product answer to "what does typing `a3f2c01` do", across web, Electron
and mobile. Inventing a mobile ranking would be the fork.

The boundary that keeps this from becoming a second search: **the sheet never calls
`searchCode`.** Its files group is `searchFiles` (fuzzy over paths) and nothing else. A query
that wants content gets one escape-hatch row — *Search contents for "…"* — which closes the
sheet, writes the query into `useFilesStore` and switches to the Search surface. One surface
hands off to the other; neither reimplements it.

## Data sources → procedures

**No new procedures, and therefore no contract change.** All three descriptors already exist
mobile-side, which is the strongest argument for the three-group shape being the right one:

| Group | Descriptor | Where | Notes |
|---|---|---|---|
| Files & folders | `searchFilesQuery` (`searchFiles`) | `lib/daemon/procedures/files.ts` | Daemon-side `fuzzySearch(query, paths, 50)` over `searchCandidates`, hidden paths already excluded (`router/files.ts:148`). Ranking is the daemon's; do not re-sort |
| Commands | `actionsQuery` (`actions`) | `lib/daemon/procedures/terminal.ts:42` | Read through the existing `useTerminalActions(active)`, which already drops `where === 'local'` — a phone has no local daemon and those actions can only fail |
| Commits | `gitLogQuery` (`gitLog`) | `lib/daemon/procedures/changes.ts` | `{ repoPath, limit: 200 }`, matched client-side. Commits older than the limit are not searched — same deliberate limitation as web |
| Go to… | none | client | `SURFACES` from `features/shell/surfaces.ts` + the settings sections. Pure |

`packages/contracts/src/procedures/names.ts` is untouched, so `lint-procedure-contracts` never
enters the picture. If a later phase wants server-ranked commit-message search it needs a real
contract addition (`searchCommits`, `io({ repoPath, query, limit }, z.array(commitSchema))` in
`refined.ts` + a `router/git.ts` procedure) — that is a phase-2 conversation, not v1.

## Interaction

**Opening.** Tablet keeps the centered field in `tablet-header.tsx` — it is web geometry and it
works. Phone gains the entry it never had: a search glyph in `phone-header.tsx` beside the
existing companion/project/branch/worktree cluster, `testID="porcelain-phone-search"`. No
gesture (a pull-down would fight `SurfaceScroll`), no keyboard shortcut (there is no key
handling in this app and quick open is not where we introduce one).

**Keyboard.** `ShellModal` owns avoidance and the sheet must not re-solve it — that is exactly
the trap `shell-sheets.tsx:56-58` records for the create forms. Concretely: this stays **one**
modal. The `useStackGuard` warning in `shell-modal.tsx:39-55` is dev-only, but the failure it
warns about (a nested native modal is not the key window on iOS and its avoidance silently
stops) is not. Anything the sheet wants to escalate into — Search tab, Terminal, a commit —
happens **after** `closeSheet()`, on the surface underneath. `autoFocus={open}` stays;
`keyboardShouldPersistTaps="handled"` stays.

**Sectioning and ranking.** Follow web: label the groups only when more than one kind is
present (`kinds > 1`), so the common case — a path search — is a heading-less list. Order is
fixed: Files, Commands, Commits, Go to…, then the content-search escape hatch last. Cap
commands and commits at five each; files take the daemon's 50 as-is.

**Loading and empty, per the house idiom.** Debounce 150 ms in the hook's caller to match
`search-panel.tsx` (not web's 100 — one constant per client). While the settled query trails the
live one, or the query is fetching, render a line of text (`porcelain-quick-open-searching`,
"Searching…"), never a spinner. Empty query → `EmptyNote` (`{ body, testID, title }` are all
required) telling the human what this is for. Query with no hits → `EmptyNote` naming the query.
Daemon error → `ErrorNote` above the results, never instead of them.

**Rows.** `SURFACE_ROW` from `components/surface-layout.ts` — the local `CommandItem` is one of
the hand-rolled row cards the last refactor pass swept up, and it must not be reintroduced.
Icons through `ChromeGlyph`, never Lucide.

**What a row does.**

| Row | Phone | Tablet |
|---|---|---|
| File | `router.push('/file/[...path]')`, mirroring `search-phone-screen.tsx:31` | `useFilesStore.openFile(path)` + `setActiveSurface('files')` |
| Folder | `router.push('/folder/[...path]')` | `openDir(path)` + `setActiveSurface('files')` |
| Commit | `useHistoryStore.openCommit(hash)` + `setActiveSurface('history')`; phone also pushes its commit route | `openCommit` + surface |
| Command | `setActiveSurface('terminal')` and hand the action over — **do not run it from the sheet** | same |
| Go to… | `setActiveSurface(id)` | same |

The command handoff is a deliberate cut. Running a saved action can require the trust prompt
(`useTrustAction`, trust is recorded against command *text*), and a trust dialog raised from a
dismissing modal is the nested-modal trap wearing a different hat. v1 navigates to Terminal with
the action selected; the human presses run where the trust UI already lives.

**testIDs** (the contract is not optional): `porcelain-quick-open` on the modal body,
`-input`, `-searching`, `-idle`, `-empty`, `-error`, `-content-escape`, per-row
`pathTestId('porcelain-quick-open-file', path)`, `porcelain-quick-open-commit-<hash>`,
`porcelain-quick-open-command-<id>`, `porcelain-quick-open-goto-<surfaceId>`. Never index-,
copy-, or timestamp-derived.

## Scope

**v1 — the mock made real.** Files/folders via `searchFiles`; commands via the existing
`useTerminalActions` (navigate, don't run); commits by SHA prefix over `gitLog(200)`; Go to…
surfaces; content-search escape hatch; phone entry point; full testID + `EmptyNote` +
text-loading treatment.

**Later, in rough order.** Recent-and-frecent files with an empty query (needs a store and a
persistence decision — `preferences-store` is the only importable-anywhere store). Commit
*message* matching, which is the contract addition above. Branch and worktree rows, once it is
clear they beat their existing dedicated sheets. Review and board items. A hardware-keyboard
path (arrow keys + Enter) for iPad users with a Magic Keyboard — the point where a key handler
finally earns its place.

## File plan

This is not a tab, so the five-file skeleton does not apply literally; the seam rules do. New
directory `apps/mobile/src/features/quick-open/`:

| File | What | Est. |
|---|---|---|
| `quick-open-sheet.tsx` | The `ShellModal` body — markup only, no daemon import | ~180 |
| `use-quick-open.ts` | **The only** daemon seam: `useFileSearch`, `useTerminalActions`, a `useGitLog`-shaped read, the 150 ms debounce, and the row handlers | ~150 |
| `quick-open-matching.ts` | Pure: `matchCommands`, `matchCommits`, `SHA_QUERY`, `gotoRows`, `groupsLabelled` | ~70 |
| `quick-open-matching.test.ts` | Beside it, colocated per house style | ~120 |

Touched:

- `shell-sheets.tsx` — delete `SearchCommandSheet`, `CommandGroup`, `CommandItem` (lines
  177-310 plus the two row helpers) and render `<QuickOpenSheet>` instead. The file is 423 of
  its 450 lines today; this is the change that gives it air.
- `tablet-header.tsx` — no behaviour change, but retire the "commits" wording if the placeholder
  copy no longer matches what v1 ships.
- `phone-header.tsx` — the new entry point.
- `features/files/files-store.ts` / `features/history/history-store.ts` — read and written
  through `use-quick-open.ts`; no new state unless recents land, which is phase 2.

Biome's `noRestrictedImports` (`biome.json:52-71`) exempts only `lib/**`, `use-*.ts` and
`*-store.ts`, so `quick-open-sheet.tsx` importing `@/lib/daemon/queries` is an error, not a
style note. Keep the split honest and nothing has to be argued about.

## Test surface

Component-level RN rendering is essentially absent in this app by doctrine; the tested thing is
the pure module. `quick-open-matching.test.ts` should assert the rules that are easy to get
subtly wrong and invisible when wrong:

- a 6-char hex query yields **no** commits (below `SHA_QUERY`'s floor) and a 7-char one does;
- an uppercase SHA matches a lowercase hash;
- a command matches on `command` text, not only `title`;
- `where: 'local'` actions never reach the rows;
- group labelling is off with one kind present and on with two;
- the caps (5 commands, 5 commits) hold when the repo has more.

Runner is the desktop config, which already globs `../mobile/src/**/*.test.{ts,tsx}`
(`apps/desktop/vitest.config.ts:59`) — nothing to wire.

## Non-goals

- **Content search in the sheet.** No `searchCode`, no `searchText`, no context lines, no
  filters. That surface exists and is better than anything a modal can be.
- **Running commands from the palette** (v1) — see the trust argument above.
- **A second modal, ever.** Every escalation dismisses first.
- **Recents on an empty query** (v1), which would need a persisted store and a decision about
  what "recent" means across worktrees.
- **A command palette for app actions** — "Go to…" is navigation, not a verb registry. Porcelain
  is not an editor; there is no `Toggle Word Wrap` to expose.
- **A keyboard shortcut.** Mobile has no key handling and this is not the feature that
  introduces one.

## The interim question: hide it until it's built?

**Yes — guard the entry point, and do it as a standalone change before any of the above.**

The case for leaving it: it is only on tablets, it looks like a real feature, and it will be
real soon. The case against, which wins: it is not a rough edge, it is *fabricated data on a
production surface*. A tablet user searching for a file they are actually working on is shown
six file paths from this repo, three commits with plausible short hashes and subjects, and three
`pnpm` invocations — none of which exist in their project, all of which do nothing when tapped.
For a product whose entire promise is that what you read is what happened, a palette that
invents commit hashes is the worst possible thing to ship half-built. It is also the kind of
thing a screenshot outlives.

The change, in `apps/mobile/src/features/shell/tablet-header.tsx`: wrap the centered `Pressable`
(lines 33-45) in `__DEV__ ? … : null`. That kills the only caller of `openSheet('search')`;
`shell-sheets.tsx:80` then never opens, the `'search'` arm of `ShellSheet`
(`shell-store.ts:7`) goes dead but harmless, and the header's centered slot simply renders
empty — the left/right clusters are content-width and absolutely positioned, so nothing reflows.
Keeping it alive under `__DEV__` rather than deleting outright preserves the surface to build
against, and makes this plan's first commit a two-line diff instead of a revert.

Do not do it as part of the feature work. If quick open slips, the guard should already have
shipped.
