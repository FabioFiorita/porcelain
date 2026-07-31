# 01 — Files tab

Status: plan. Depends on `00-connection.md` (must be merged to `main` first).
Read `apps/mobile/docs/daemon-api.md` (Files-tab catalog + mobile cautions), the
`architecture` skill "Native mobile client" section, and the `expo-router` /
`expo-ui` skills before starting.

## 1. Mission

Make the phone a trustworthy way to *look at* the repo the daemon has open:
drill through directories, find a file by name, read it. Files is the landing
tab and the app's proof that the mobile client is a real client of the same
daemon — so it must honor the monorepo scoping that makes Porcelain's desktop
tree usable (hidden folders stay hidden, pinned folders stay one tap away) and
must never load what the screen isn't showing. It is a **viewer**: this release
ships read-only, because the phone's job is review, not authorship.

## 2. UX shape

### 2.1 One screen per directory (pushed stack), not an expanding tree

**Decision:** each directory is its own pushed stack screen. The Files tab's
root screen lists the repo root; tapping a folder pushes a new screen for that
folder; the native back gesture / back button walks out.

Why, against the desktop's expanding tree:

- The platform idiom agrees. iOS Files.app, and every native
  file browser, drills down; an indented tree spends the phone's scarcest axis
  (width) on indentation and its deepest rows end up 10 characters wide.
- Free correctness: the native stack gives back-swipe, per-screen large titles,
  scroll position restoration per level, and a `Link.Preview` peek — all of
  which a hand-rolled expanding tree would have to reimplement.
- Free performance: one screen = one `readDir` for one directory. An expanding
  tree keeps every expanded directory's rows mounted in a single list and needs
  its own virtualization and its own eviction policy. "Never fetch what isn't
  visible" falls out of the navigation model instead of being a rule to enforce.
- The desktop tree exists because a 27" sidebar can show context above and below
  the current folder. That context is not available on a phone anyway.

Cost accepted: no cross-directory glance, and a deep path takes N taps. Search
(2.2) and pinned entries (2.5) are the mitigations, exactly as on desktop.

**Routing.** Route params carry the **repo-relative** path as a catch-all
segment array, not the daemon-absolute path: absolute paths start with `/`
(an awkward empty first segment) and leak the daemon's home into every href.
The screen joins `activeRepo.path` + segments to get the daemon path for the
query. Search results (which come back absolute) are relativized before
building an href. All path math lives in one module (`file-paths.ts`) — nothing
else in the slice does string surgery on paths.

- `/(files)` — repo root listing (existing `index.tsx`)
- `/(files)/dir/[...path]` — one directory
- `/(files)/file/[...path]` — the viewer

Each pushed screen sets its own title (`Stack.Screen.Title` = the entry's
basename). `headerLargeTitle` stays on the root screen only.

**List rendering.** A JSX-node-per-row list is unsuitable for large lists
whatever the layer (each row is a JS-thread node), and a monorepo directory can
hold thousands of entries. Use React Native's `FlatList` (virtualized) with
`@expo/ui/swift-ui` primitives inside the row, wrapped per the repo's existing
`Host` pattern; keep `contentInsetAdjustmentBehavior="automatic"` so the large title
and the search bar behave. If a directory returns more than ~2,000 entries,
render them all through the virtualized list — do not paginate; `readDir` is a
single cheap call and slicing would hide files from the user.

Row anatomy: folder/document SF symbol (`folder.fill` / `doc.text`), name,
and a trailing secondary label only when it carries meaning (`Pinned`, or a
dimmed `Hidden` when "Show hidden" is on).

### 2.2 Search

The header `Stack.SearchBar` already on the Files screen becomes real, on the
**root screen only** (pushed directory screens have no search bar — search is
repo-wide, not directory-scoped, so offering it deeper would lie about scope).

- `onChangeText` → local state → 250 ms debounce → `searchFiles({repoPath,
  query})`, enabled only when the trimmed query is non-empty.
- While a query is active, the results list **replaces** the root listing in
  place (the iOS convention), with `placeholderData: keepPreviousData` so rows
  don't blank between keystrokes. Cancel restores the listing.
- Results are server-capped at 50 and already exclude hidden paths (the
  daemon's `searchCandidates` filters them) — so search honors scope for free,
  and the "Show hidden" toggle deliberately does **not** apply to search. Say so
  nowhere in the UI; it just behaves like the desktop finder.
- Row: basename in the primary line, repo-relative parent directory dimmed
  below. `kind === 'dir'` pushes the directory screen, `file` pushes the viewer.
- Empty query → the normal listing. Non-empty with zero results → a centered
  "No files match <query>" state. Never show a spinner over previous results.

### 2.3 File viewer

One screen, one `readFile(absPath)` query, one switch on the discriminated
union. Every state is a designed state — no raw error text, no infinite spinner.

| `type` | UI |
|---|---|
| `text` | Monospace, soft-wrapped, selectable text in a scroll view. No line numbers, no syntax highlighting (2.4). If the content exceeds ~256 KB or ~5,000 lines, render the head and a pinned footer note: "Showing the first N lines of this file — open it on the desktop for the rest." A 10 MB single `Text` node is a frozen JS thread, not a feature. |
| `image` | The `dataUrl` in an RN `Image` with `resizeMode="contain"` on a neutral backdrop; pinch-zoom is out of scope. |
| `binary` | Icon + "Binary file" + humanized size. |
| `too-large` | Icon + "Too large to open (N MB)" + the daemon's 10 MB limit stated plainly. |
| `not-found` | "This file is no longer here." + a button that invalidates the parent directory query and pops back — the stale-row case the daemon comments call out. |
| query error | Connection-level failures (no environment, unauthorized, unreachable) never reach here — `DaemonGate` catches them. What's left is per-call: render 00 §4's error-taxonomy copy for the `DaemonError.kind` (`unsupported` → "Your daemon is too old for this", `invalid-response` → "Unexpected response from the daemon", `daemon-error` → the daemon's own message verbatim). Not a Files-local invention. |

Loading is a single centered activity indicator; the header title (basename) is
available immediately from the route params, so the screen never looks blank.

### 2.4 Markdown, highlighting

**Decision: neither in this release.** `readFile` returns raw text and the app
has no markdown renderer or highlighter; adding one means either a new
dependency with a hand-rolled component layer (against rule 5's
`@expo/ui/swift-ui`-only) or an HTML/WebView path whose sanitization is an `audit`-skill concern
worth its own change. **Do not mistake `Text`'s `markdownEnabled` for a way out:**
it renders SwiftUI `LocalizedStringKey` markdown, which is inline-only (emphasis,
code spans, links) with no headings, lists, tables, or code blocks — a README
would come out as one run-on paragraph, which is worse than the source.
Markdown files show their source, which is honest and readable. The desktop's Reader/Source toggle is a deliberate absence here,
recorded in section 5 with the WebView path as the eventual route.

### 2.5 Hide / pin

Scope is the differentiator; the phone honors it and can change it.

- **Hidden is hidden.** `readDir` is called with `showHidden: false` by default.
  A "Show hidden" toggle lives in a header `Stack.Toolbar.Menu` (SF `ellipsis`)
  as a `MenuAction isOn`, is app-level state (not per-directory), and persists
  across launches via the connection layer's preference seam
  (`usePreference('files.showHidden', z.boolean(), false)` from
  `src/lib/daemon/preferences.ts`, 00 §2). With it on,
  hidden rows render dimmed with a `Hidden` trailing label.
- **Pinned surfaces at the root.** The root screen renders a `Pinned` section
  above the root listing, fed by `pinnedEntries(repoPath)`, hidden entirely when
  empty. Pushed directory screens have no pinned section.
- **Long-press changes scope.** Every row is a `Link` with a `Link.Trigger` and
  a `Link.Menu`: `Pin`/`Unpin` (`pin`), `Hide`/`Unhide` (`eye.slash`), `Copy
  path` (the daemon-absolute path, via `expo-clipboard` — 00 already adds it as a
  dependency for the pairing screen's Paste button, so this costs nothing).
- **`Link.Preview` on directory rows only.** A peek renders the target route,
  which means a preview on a *file* row fires `readFile` and can pull a
  multi-megabyte data URL over cellular for a gesture the user may not commit
  to. Directory previews only cost a `readDir`. This is the one place where
  "use previews frequently" loses to the payload cautions.
- Scope mutations are in scope for this release even though *file* mutations
  are not: they write `~/.porcelain/scope.json`, not the user's code, they are
  reversible in one tap, and the desktop/CLI already treat them as two-way
  config. Hiding is what makes a 50 GB monorepo usable from a phone.

### 2.6 No-environment / no-repo hand-off

Files never renders a spinner into the void — and it writes **zero** empty-state
UI of its own. Every Files screen wraps its body in the connection layer's
`DaemonGate` (00 §2, `src/components/daemon-gate.tsx`):

```tsx
<DaemonGate requires="repo">…</DaemonGate>
```

`requires="repo"` covers both cases: no paired environment renders "Pair your
first daemon" (→ `/settings/environments/pair`), and paired-but-no-repo renders
"Choose a repo" (→ the `/repo` sheet 00 owns). Files must not implement a second
repo picker, a second empty-state component, or its own reading of
`useConnectionState`. The search bar hides while the gate is showing.

`useActiveRepo()` (00 §2) is the only source of the repo path this slice reads.

### 2.7 iPad: the split view this slice owns (approved 2026-07-31, build it here)

The pushed drill-down of 2.1 is a **phone** decision, and it stays the phone
decision. On iPad it wastes the axis the phone didn't have: a 13" screen showing
one directory at a time, one tap deep, is the complaint that opened this section.
The target is the Notes/Mail idiom — sidebar, list, detail — which is also what
the desktop client already is.

**The constraint that decides the shape.** `expo-router`'s `SplitView`
(`expo-router/unstable-split-view`, alpha, iOS-only) throws
`SplitView cannot be used inside another navigator, except for Slot` — it checks
`IsWithinLayoutContext` at render. So a split view **cannot** live inside the
Files tab. Reaching Notes-like Files on iPad means the **root** layout branches:
iPhone keeps `NativeTabs`, iPad renders `SplitView` whose primary column carries
the four destinations (replacing the tab bar the way Notes has no tab bar),
supplementary = the directory listing, secondary = the viewer. `sidebarAdaptable`
on `NativeTabs` — already shipped — is the *interim* answer, not this one.

Why it lands in **this** plan rather than as its own change: columns over
`PlaceholderScreen` prove nothing. The split view is only reviewable once there
is a real tree, a real viewer, and a real selection to keep in sync — which is
exactly what 01 builds. Constraints on whoever takes it:

- **One route table, two presentations.** The routes of 2.1 (`/(files)`,
  `/(files)/dir/[...path]`, `/(files)/file/[...path]`) do not change. The iPad
  shell selects *where* a route renders; it must not introduce iPad-only routes,
  an iPad-only path format, or a second copy of the listing screen. Two shells
  are already the cost being paid — two route tables would be a second
  architecture (hard rule 1) and is not approved.
- **The fork is at the root layout only** (`src/app/_layout.tsx`), sized with the
  runtime idiom check, not a hard-coded width. Nothing under `src/features/files/`
  may branch on iPad.
- **Selection state is the URL.** The secondary column reflects the current
  route; do not add a parallel "selected file" store the router doesn't know about.
- Confirm `topColumnForCollapsing` behaviour for a compact-width iPad window
  (Stage Manager, Slide Over) — the app must still be usable when the split view
  collapses, and that is the state the original screenshot was actually in.
- Proof needs an **iPad** simulator specifically, not the iPhone simulator §6
  defaults to. Attach a landscape iPad screenshot with all three columns populated and a
  compact-window screenshot to the Review, or the change is not verified.

## 3. Data layer

All procedures are on the flat daemon router; reach them through the seams
`00-connection.md` §2 defines — nothing in this slice builds a tRPC client, reads
`expo-secure-store`, or opens a socket.

- Declare each procedure once with `defineQuery` / `defineMutation` (from
  `src/lib/daemon/procedure.ts`) in **`src/lib/daemon/procedures/files.ts`** —
  this slice's own file; never edit `procedures/connection.ts`, and there is no
  barrel.
- Call them with `useDaemonQuery(descriptor, input, options)` /
  `useDaemonMutation(descriptor, { invalidates })`; invalidate imperatively with
  `useDaemonInvalidate()(['readDir', 'pinnedEntries'])`.
- **Never hand-roll query keys.** The key is
  `['daemon', envId, procedureName, input ?? null]`, produced by `daemonKeys` —
  the environment id is already in it, so switching daemons can never serve
  another repo's tree.
- Every output gets a zod schema on its descriptor; a shape the daemon changed
  surfaces as `invalid-response`, not an undefined-property crash.

| Procedure | Where | Notes |
|---|---|---|
| `readDir {repoPath, path, showHidden}` | every listing screen | `DirEntry[]` = `{name, path, kind, hidden, pinned}`, already sorted dirs-first |
| `pinnedEntries(repoPath)` | root screen only | `DirEntry[]`; entries whose path vanished are dropped daemon-side |
| `searchFiles {repoPath, query}` | root screen, debounced | `{path, kind}[]`, max 50, hidden-filtered |
| `readFile(absPath)` | viewer screen only | the five-way union |
| `hidePath` / `unhidePath` / `pinPath` / `unpinPath` | row context menu | `{repoPath, path}`, returns void |

`repoScope` is **not** used: `readDir` and `pinnedEntries` already carry the
`hidden`/`pinned` flags, so a second source of scope truth would be a second
architecture for the same fact.

**Staleness / caching**

- `readDir`, `pinnedEntries`: `staleTime` 30 s, refetch on screen focus.
- `readFile`: `staleTime` 60 s and a **short `gcTime` (~2 min)** — image data
  URLs are base64 strings up to ~13 MB and must not accumulate in the cache
  behind the user.
- `searchFiles`: `staleTime` 0, `keepPreviousData`, no refetch on focus.
- No polling anywhere in Files. `refetchOnWindowFocus` off; screen focus
  (`useFocusEffect`) is the refetch trigger, per the daemon-api's instruction
  that mobile polls more lazily than the browser client.

**Live updates** (WS app-events, delivered by the connection layer). The map is
`APP_EVENT_INVALIDATIONS` in `src/lib/daemon/app-events.ts` — the one file all
five worktrees append to, flat and alphabetical. 00 seeds these rows already;
Files only appends a name if it introduces one:

- `file-tree` → `readDir`, `searchFiles`, `pinnedEntries` (seeded).
- `scope` → `readDir`, `pinnedEntries` (seeded — an agent or the CLI changed
  hide/pin while the phone was looking).
- `working-tree` → append `readFile` to the seeded row (an agent rewrote the
  open file).

Scope mutations invalidate `readDir` + `pinnedEntries` on success as well; the
`scope` event is the backstop, not the primary path.

**Watch registration.** `working-tree`/`file-tree` are targeted at the session
that registered a watch, so Files must publish what it's looking at: the set of
open directory paths and the open file path, through
`useDaemonSession().watch({ dirs, files })` (00 §2), whose return value is the
unregister. Files supplies the path sets; the connection layer owns re-sending
them after a reconnect. Re-register only when the set actually changes, not on
every screen focus.

**Payload cautions**

- Every path in every call is a **daemon-side** path. Nothing in this slice
  touches the phone's filesystem.
- Never call `readFile` for a `kind: 'dir'` entry.
- The viewer query is enabled only while the viewer screen is mounted and
  focused — combined with the no-preview-on-files rule (2.5), the app never
  fetches a file body the user didn't ask for.

## 4. Files to create / change

Feature slice — `apps/mobile/src/features/files/`:

| File | Role |
|---|---|
| `files-screen.tsx` | rewrite the placeholder: root listing + Pinned section + search bar + toolbar menu, inside `DaemonGate requires="repo"` |
| `directory-screen.tsx` | one pushed directory |
| `file-screen.tsx` | the viewer and its five union states |
| `entry-list.tsx` | the virtualized `FlatList` + row (icon, labels, `Link`/`Link.Trigger`/`Link.Menu`/conditional `Link.Preview`) shared by root and directory screens |
| `search-results.tsx` | debounced-query results list and its empty state |
| `use-files.ts` | every query/mutation hook, staleness config, invalidation, watch-path publishing |
| `file-paths.ts` | repo-relative ↔ daemon-absolute, href builders, basename/parent, byte-size humanizer |
| `files-empty-states.tsx` | no-results + viewer non-text states (small, shared). **Not** the pair/choose-repo states — `DaemonGate` owns those |

Routes — `apps/mobile/src/app/(tabs)/(files)/`:

| File | Change |
|---|---|
| `index.tsx` | unchanged one-line re-export |
| `dir/[...path].tsx` | new one-line re-export of `DirectoryScreen` |
| `file/[...path].tsx` | new one-line re-export of `FileScreen` |
| `_layout.tsx` | register the two new screens (standard titles, keep `headerBackButtonDisplayMode: 'minimal'`) |

Also new, and owned by this slice alone:
`src/lib/daemon/procedures/files.ts` — the `defineQuery`/`defineMutation`
descriptors for the five procedures in §3.

Shared merge points — keep to these four, they are what parallel worktrees
will collide on:

- `src/lib/daemon/app-events.ts` — append `readFile` to the seeded
  `working-tree` row. One line, alphabetical, nothing else.
- `src/components/toolbar-icon.ts` — add one icon name (`more`) to
  `ToolbarIconName` and `SF_SYMBOLS` (`ellipsis`). `settings`, `board`, `history`
  are already there; 00 adds `repo`. iOS-only, so that is the whole edit — no
  raster twin.
- `apps/mobile/README.md` — one short paragraph on what the Files tab does and
  that it is read-only. Docs sync in the same commit (hard rule 4).
- `src/lib/surface-handoffs.ts` — the tiny shared module `03-review.md` §2.4
  specifies (typed `openDiff` / `openFile` href pushes). Files is the **target**
  of `openFile`: it takes a daemon-absolute path, relativizes it with this
  slice's `file-paths.ts`, and pushes `/(files)/file/[...path]`. If 03 lands
  first the module already exists — implement/keep that signature, don't fork a
  second helper. Until this slice's viewer route exists, `openFile` falls back
  to the Files tab root, which is exactly what 03 assumes.

No other tab and no `src/theme` change. **One root change, and only for §2.7:**
`src/app/_layout.tsx` gains the iPad `SplitView` branch (00 owns that file's
providers and sheet routes — add the branch, don't restructure them). If §2.7
is deferred past this worktree, the root layout stays untouched.

## 5. Out of scope (deliberately absent)

- **Editing.** No `writeTextFile`, no textarea, no autosave. Reasons, in order:
  the phone's job is review, not authorship; the desktop's always-editable
  textarea depends on a watch-driven invalidation loop that a backgrounded app
  on a flaky LAN turns into silent overwrite of an agent's concurrent write; and
  a 10 MB-capable debounced upload over cellular is a bad default. Revisit only
  with an explicit conflict story.
- **Filesystem mutations** — `createFile`, `createFolder`, `renamePath`,
  `duplicatePath`, `trashPath`. Destructive daemon-side operations with no undo,
  behind a device that gets left on tables.
- **`previewHtml`** — a whole inlined HTML document rendered in a WebView; a
  payload and sandboxing question of its own, and nothing on the phone needs it.
- **Markdown Reader/Source toggle** and **syntax highlighting** (2.4). The
  eventual path is a sanitized render inside the already-present
  `react-native-webview`, planned separately.
- **Content search** — `searchText` / `searchCode`. The header search bar is
  filename-fuzzy only, matching the desktop finder.
- **Two panes on a phone** — an iPhone shows one column, and §2.7's iPad split
  view is the *only* sanctioned multi-column Files. Also out: multi-select,
  drag-and-drop, per-type file icons beyond folder/document, git-status badges on
  rows, pinch-zoom on images.
- **Repo and environment switching** — owned by the connection layer; Files
  only hands off to it.

## 6. Verification

Static gate (from the repo root):

```bash
pnpm typecheck:mobile     # tsc --noEmit in apps/mobile
pnpm lint                 # biome; note noDefaultExport is off ONLY under src/app
pnpm verify               # the rule-3 gate; hook-enforced before any commit
```

Do **not** add a test runner to `apps/mobile`. 00-connection extends the **root**
vitest `include` to `apps/mobile/src/**/*.test.ts`, so the one pure module worth
covering here (`file-paths.ts`: relative ↔ absolute, href building, basename) can
have a small test under the root runner. Everything else is proved at runtime.

Runtime proof — **iOS simulator on the Mac**, driven from here over the LAN
(`serve-sim-remote` skill), against the **dev** daemon on **43118**. Never 43117.
Full recipe and traps: `README.md` → *Shared verification recipe*.

```bash
pnpm build && pnpm dev:daemon                      # dev daemon on 43118, LAN-bound by default
PORCELAIN_HOME=~/.porcelain-dev PORCELAIN_DAEMON_PORT=43118 \
  node scripts/daemon-cli.js access issue --name "Simulator" \
    --base-url http://<this-host>.local:43118      # LAN URL — the sim is on the Mac, not here
pnpm mobile:start                                  # Metro here; the sim loads the bundle over the LAN
python3 ~/.claude/skills/serve-sim-remote/scripts/shot.py /tmp/files-<journey>.jpg
```

The `PORCELAIN_HOME` / `PORCELAIN_DAEMON_PORT` prefix is not optional — without it
`daemon-cli.js` issues the link against the **production** daemon on 43117. First
run on a fresh simulator needs the dev client installed once from the Mac
`eas build -p ios --profile development-simulator` on the host, then `eas build:run -p ios --profile development-simulator --latest` on the Mac, which downloads, installs, and launches it).
§2.7's iPad columns need an **iPad** simulator booted, not the iPhone one.

Point the dev daemon at a repo with a real nested tree and at least one hidden
path (set one with `pnpm porcelain -- scope hide --path <path>` if none exists).

Journeys to capture (one screenshot each, attached to the Review's Evidence):

1. Root listing with a non-empty **Pinned** section above the tree.
2. Two levels deep in a nested directory — correct title, back stack intact.
3. A text file open and readable in the viewer.
4. Search for a filename fragment → results list → the opened file.
5. A hidden directory **absent** by default, then present-and-dimmed after
   toggling "Show hidden" (two frames).
6. One non-text state — `binary` or `too-large` — on a known file.

Also verify by observation, not assumption: with the app idle on a directory
screen, `pnpm porcelain -- scope hide --path <some-dir>` from the host makes the row
disappear without a manual refresh (proves the `scope` app-event wiring).

## 7. Worktree notes

- Slug: `files-tab` → `pnpm worktree create files-tab` (branch `work/files-tab`,
  isolated daemon state, playground).
- **Starts after `00-connection.md` is merged to `main`.** Create the worktree
  from an up-to-date `main`; if 00-connection lands mid-flight, rebase before
  finishing rather than duplicating a client.
- The managed worktree gets its own daemon port from the 43200–43999 pool — pair
  the simulator against **that** port, not 43118.
- The seams Files needs all exist in 00 §2: `useActiveRepo`, `useDaemonQuery` /
  `useDaemonMutation` / `useDaemonInvalidate`, `useDaemonSession().watch`,
  `usePreference`, and `DaemonGate`. If something genuinely missing turns up, add
  it **in the connection layer** and say so in the PR — do not grow a second
  client inside `features/files`.
- Close the loop: PR into `main` with the Review's evidence attached, then
  `pnpm worktree remove files-tab`. Delete simulator screenshots and scratch
  before stopping.
