# Review canvas — live doc

Written 2026-07-20 in a Mac **planning-only** session — execution happens on THIS
checkout (the Beelink), not the Mac. Status: **A+B SHIPPED** (2026-07-20); **C (Excalidraw medium) still open**
(maintainer review 2026-07-20: Pieces 1–3 solid; Excalidraw promoted from deferred
to first-class medium; agent chooses HTML vs Excalidraw per canvas tab).

User feedback on the shipped Review (screenshots in session): the sidebar title
doesn't read as clickable, and the loop evidence sits at the bottom of a very
long document — "this changed a ton of files and i had to scroll a lot"
(0/48-reviewed set).

## The pains (user's words)

1. "The title is not something that show me that is clickable — we should have
   that icon that show it can be open."
2. "It's very bad that i need to move all the way to the bottom to see the loop
   evidence."

## The direction (user-sanctioned)

1. Title gets an affordance icon showing it opens something.
2. Title click opens a **canvas** ("can be html for now"), NOT the inline
   all-files document. The canvas carries the **pre-information** (what the
   agent attempted — the old feature-artifact role) **and the loop evidence**,
   "we can even add some tabs to split this."
3. Files stay in the sidebar as today (file name + agent NOTE; click opens the
   file). New: a file opened from the Feature list **highlights the
   agent-changed lines** ("the agent changed 30 lines → highlight those
   lines"); review comments keep rendering in the file itself (already true —
   don't regress).

## Current mechanics (verified on main, file:line)

**Sidebar — `src/renderer/src/components/git/feature-list.tsx`:**
- Title button (275–281): plain `<button>` → `openReview()` (224–232), which
  does `openTab({ id: tabId('feature', repo.path), kind: 'feature', … })` — one
  pinned tab per repo. Only affordance today is `hover:text-foreground/80`.
- "N/M reviewed" counter (291–294); Clear (eraser, two-step) (295–317).
- Chapter rows (324–330) → `openReview({ kind: 'section', index })` — opens the
  feature tab AND `requestJump(...)` (review-focus store) to scroll there.
- File rows `OutlineFileRowImpl` (51–152): click (68–75) opens a **diff** tab
  for `changed` files, a **file** tab otherwise; agent NOTE block (140–149);
  context menu = Mark reviewed / Comment on file (124–137).
- Loop evidence row (371–385) → `openReview({ kind: 'evidence' })` — opens the
  feature tab and scrolls to the evidence chapter at the document's end.

**Viewer — `src/renderer/src/components/git/feature-view.tsx` (117–153):**
header (name + per-source counts) over `<ReadingSurfaceBody reading trackFocus />`;
`useReviewKeys` gives J/K chapter nav + Z zen (44–78); EmptyState (83–109).

**Reading surface — `src/renderer/src/components/git/reading-surface.tsx`:**
`buildRows` (136–161) flattens thesis → sections (prose + sandboxed diagram +
anchored files) → "More files" → **`evidenceHeader` + `evidenceBody` LAST**
(156–159). Rows render through `VirtualRows dynamicHeight` in
`ReadingSurfaceBody` (644–727). `EvidenceBodyRow` (488–504) is a fixed
`h-[28rem]` iframe box fed by `useEvidenceHtml`; `EvidenceHeaderRow` (458–483)
carries the Clear button. Focus plumbing: `buildRowFocus` (175–204),
`rowIndexForTarget` (207–218), store `stores/review-focus.ts`
(`ReviewJumpTarget = { kind: 'top' | 'section' | 'evidence' }`, 17–21).
**Shared:** `review-view.tsx` (Changes/History diff review) and
`explore-view.tsx` also render `ReadingSurfaceBody` — the evidence split must
be opt-in so those two are untouched.

**Loop evidence:** `~/.porcelain/loop-evidence/<hash>/index.html` → tRPC
`loopEvidenceHtml` (`api.ts` 1019–1021) → `HtmlView`
(`components/viewer/html-view.tsx` 21–28) = `<iframe sandbox="" srcDoc>`.
Audit invariant: never an `allow-*` token, never `src`, CSP
`img-src`/`default-src` unchanged. **Placement may change; the boundary may
not.**

**File viewer:** `viewer.tsx` → `FileContent` → `TextFileView`
(`text-file-view.tsx` 130–146) → `EditorSource` (≤ `EDITABLE_MAX_LINES`) or
`SourceView` (`source-view.tsx`, 45 lines). `SourceView` already supports a
single `highlightLine` (row tint `bg-primary/15` + `scrollToLine`) and
`commentsByLine` → `LineDecorations` (comment tints + gutter markers +
resolve popover). `Tab` (`stores/tabs.ts` 23–46) already carries `line?`.

**Data:** `ReadingFile` (`src/backend/feature-view.ts` 226–242) — `changed`
files carry `hunks` (new-side line numbers); context/shipped carry `ranges`.
The Feature list ALREADY consumes the full `featureReading` (3s poll), so hunk
line-ranges are available in the sidebar with **zero new backend work**.

**shadcn:** `components/ui/tabs.tsx` is already vendored — Piece 2 needs no new
primitive (hard rule 5 satisfied).

## Piece 1 — Sidebar title affordance (~XS)

`feature-list.tsx` 275–287. Make the title row read as an opener:
- Trailing affordance icon on the title button — default pick **`ArrowUpRight`**
  in `text-muted-foreground`, visible at rest (the complaint is discoverability
  at rest, so no hover-only reveal), tinting to `text-foreground` on hover.
- Give the button the standard row hover (`rounded-md hover:bg-sidebar-accent/50`)
  so it behaves like every other clickable row — one interaction language
  (architecture: hover/selected = `bg-accent`/`bg-accent/50`, nothing bespoke).
- Keep the wrap-not-truncate behavior and the existing Refresh/Clear cluster.

## Piece 2 — The Review canvas: tab the feature view (~M)

Rework `FeatureView` internals; **no new `TabKind`** — the sidebar keeps opening
`kind: 'feature'` and the tab's content changes. Header (name + counts) stays;
the body becomes the vendored shadcn `Tabs`:

- **Overview** (default) — today's document minus the evidence chapter: thesis →
  walkthrough sections (prose + sandboxed diagrams + anchored code) → "More
  files". Implementation: `buildRows` gains an opt-in flag (e.g.
  `includeEvidence: false`) or an `OverviewBody` wrapper that drops
  `evidenceHeader`/`evidenceBody`; `ReadingSurfaceBody`'s current behavior stays
  the default so `review-view.tsx` / `explore-view.tsx` are byte-identical.
- **Loop evidence** — new `components/git/evidence-panel.tsx`: full-height
  `HtmlView` (same `sandbox="" srcdoc` — audit invariant untouched), header row
  = evidence title + `updatedAt` + the Clear button lifted from
  `EvidenceHeaderRow`. Replaces the `h-[28rem]` box — evidence gets the whole
  viewer, which is the actual fix for pain #2.

Focus/jump plumbing (`stores/review-focus.ts`): a jump becomes
`{ tab: 'overview' | 'evidence', target: ReviewJumpTarget }`. `FeatureView`
consumes it: select the tab, then (section/top) scroll the virtualizer as
today. Consequences:
- Sidebar **Loop evidence** row → opens the feature tab **directly on the
  evidence tab** — no scrolling, ever, regardless of set size.
- Chapter rows → Overview tab + section scroll (unchanged feel).
- J/K nav stays scoped to Overview (the evidence iframe eats keys — accepted);
  Z zen is global chrome, unaffected.
- Quick Access `review-group.tsx` ("Now reading") mirrors the active tab too
  (shows "Loop evidence" when it's the active one).

Tab state itself is component-local `useState` in `FeatureView` (state
placement rule), driven by the review-focus store for external jumps.

## Piece 3 — Changed-line highlighting in the file viewer (~M)

User flow: Feature sidebar file click → the **file** opens, agent-changed lines
tinted, scrolled to the first change, comments visible in-file (already wired).

- **Pure helper** in `src/renderer/src/lib/` (+ sibling test, per conventions):
  `highlightRangesForFile(file: ReadingFile): { start: number; end: number }[] | undefined`
  — union of the file's hunk new-ranges for `changed` files, `undefined`
  otherwise. Clamp to the file's line count at render (ranges go stale the
  moment the agent edits again — decoration only, transient mismatch is fine;
  the open file's content already refreshes via the dir watcher).
- **`Tab` gains `highlight?: { start: number; end: number }[]`**
  (`stores/tabs.ts`). Sidebar `open()` (feature-list.tsx 68–75) changes to:
  every source opens a **file** tab (absolute path); `changed` files attach
  `highlight` + `line: ranges[0].start` (the existing scroll path). The diff
  stays one gesture away: context menu gains **"Open diff"** for changed files
  (keep the hover diff-prefetch, it now serves that menu item).
- **`addTab` merge check** (`stores/tabs.ts` 93–112): re-opening an already-open
  id activates in place — verify it refreshes `line`/`highlight` from the new
  open request; if it doesn't, extend the merge (pure store, unit-test it).
- **Threading:** `FileContent` passes `tab.highlight` → `TextFileView` (new
  `highlightRanges` prop) → `EditorSource` / `SourceView` (read
  `editor-source.tsx` at implementation; it already takes `highlightLine` +
  `commentsByLine`, so ranges plug in the same way).
- **Render** (`source-view.tsx` 28–41): row tint from a **diff token** —
  default pick `bg-diff-add/10` plus a 2px left bar in `bg-diff-add` — NOT
  `bg-primary/15` (that one means find/search). Tokens are already dual-themed.
  When a row has both a changed-line tint and a comment tint, the comment tint
  wins (it's the actionable one).
- **Scroll:** `scrollToLine={line ?? highlightRanges?.[0]?.start}` — the
  existing virtualizer path, centered.
- **Edge cases:** untracked file = the whole file is one hunk — if ranges cover
  ≥90% of lines, skip the tint (noise) and just scroll to top. Binary/too-large/
  markdown-reader/html-preview: no highlight (FileContent dispatch unchanged).
  `VirtualRows` stays fixed-height (perf invariant) — row tinting doesn't
  measure anything.

## Maintainer review (2026-07-20)

**Verdict: solid plan.** Pieces 1–3 correctly map the two reported pains onto
the real code, respect the one architecture (no new `TabKind`, shadcn Tabs
already vendored, component-local tab state + review-focus for jumps), keep the
evidence sandbox invariant untouched, and ship a real verification ladder
(unit → component → browser e2e → live). Taste defaults are good; Phase split
A/B is right.

**What checked out against main (spot-check):**
- Title → `openReview()` → `kind: 'feature'` (one tab per repo); only
  `hover:text-foreground/80` today — Piece 1 is the right fix.
- `buildRows` still appends evidence last; evidence already has
  `evidenceHeader` + **`evidenceChecks`** + `evidenceBody` — Piece 2's panel
  must lift the **checks list** too (plan only named header + body).
- File open: `changed` → diff tab, else file tab; `SourceView` has single
  `highlightLine` + comments; `Tab` has `line?`; `addTab` merges `line` but
  would need the same for `highlight` — Piece 3's store note is correct.
- `ReadingFile` hunks already in `featureReading` — zero new backend for
  ranges. shadcn `tabs.tsx` vendored. CSP / sandbox invariants match `audit`.

**Nits (not blockers):**
1. Line numbers in "Current mechanics" have drifted a bit (title button is
   ~288–294, not 275–281) — read the symbols, not the numbers at implement.
2. Product phrasing "NOT the inline all-files document" vs Overview = "today's
   document minus evidence": still keeps anchored code in Overview. That's fine
   for v1 (fixes scroll-to-evidence without ripping the walkthrough); the freeform
   medium (below) is the path when the agent wants a pure canvas instead.
3. Original Excalidraw rec was "defer" — **overruled**: maintainer wants
   Excalidraw first-class; agent picks medium per tab via skills.

**React 19 peer — VERIFIED (2026-07-20):** `@excalidraw/excalidraw@0.18.1`
declares `react: '^17.0.2 || ^18.2.0 || ^19.0.0'`; repo is on React 19.2.x. GO.

## Piece 4 — Dual medium: HTML | Excalidraw on both canvas tabs (~L)

**Product decision (maintainer):** both canvas tabs — **Overview** and **Loop
evidence** — can render either **HTML** or **Excalidraw**. The agent chooses
per task; skills teach the criteria. Not a third tab; a **medium** on each of
the two tabs Piece 2 builds.

### Medium model

```
medium = 'document' | 'html' | 'excalidraw'
```

| Tab | Default (today's data) | Freeform alternatives |
|---|---|---|
| **Overview** | `document` — structured reading surface (thesis → sections → More files; **no** evidence chapter). This is what Pieces 1–2 ship when the agent only publishes a review set. | `html` — full-height sandboxed `HtmlView` from an agent-authored overview doc; `excalidraw` — full-height read-only Excalidraw scene. |
| **Loop evidence** | `html` — today's `index.html` + checks (full-height panel). | `excalidraw` — scene file in the evidence dir instead of (or as the primary body for) HTML. |

Resolution rules (deterministic, no UI picker for the human):
- **Evidence:** if the evidence dir has a recognized scene file
  (e.g. `canvas.excalidraw` / `scene.json` with the Excalidraw shape) and no
  `index.html` → `excalidraw`. If both exist, prefer **html** for body + still
  show checks (HTML wins when the agent wrote both; skills say pick one).
  Missing both but checks exist → checks-only panel (already true today).
- **Overview:** if the review set carries an explicit freeform canvas payload
  (`canvas: { medium: 'html' | 'excalidraw', … }`) → render that full-height
  and **do not** flatten the reading surface into the same pane (outline still
  lists sections/files from the set for navigation into file tabs). If no
  freeform canvas → `document` as Piece 2. Agent may publish thesis/sections
  *and* a freeform canvas; freeform is the Overview body, sections remain the
  outline spine (click section → still useful for file list; optional later:
  section jump only when medium is `document`).

### Renderer

- Shared `CanvasPane` (or two thin wrappers) that switches on medium:
  - `document` → `ReadingSurfaceBody` with `includeEvidence: false`
  - `html` → full-height `HtmlView` (`sandbox="" srcDoc` — **no** `allow-*`,
    never `src`; audit invariant unchanged)
  - `excalidraw` → lazy `React.lazy` Excalidraw host (`viewModeEnabled`,
    `zenModeEnabled` optional) fed parsed scene JSON
- Excalidraw **must** self-host fonts (`window.EXCALIDRAW_ASSET_PATH` →
  vendored `dist/prod/fonts` under renderer assets). Never widen CSP
  `font-src` / `img-src` / `default-src` for CDN loads.
- Links inside a scene: verify navigation goes through `window.open` so main's
  `setWindowOpenHandler` + `isSafeExternalUrl` gate them; remote image URLs
  stay blocked by CSP; embedded `files` dataURLs work.
- Lazy chunk only: Excalidraw must not land in the main renderer graph until a
  tab with medium `excalidraw` mounts. Measure gz cost in Phase C.

### Authoring channel (CLI + skills)

Agents do **not** hand-type Excalidraw JSON. Realistic path:

- **Overview freeform:** CLI e.g. `review set-canvas --medium html|excalidraw
  (--html-file <p> | --file <scene.excalidraw>)` writing into the review set
  (zod: size-capped scene JSON, same order of magnitude as `diagram` 256KB or
  a higher but hard cap — pick at implement, unit-test the cap). Clearing the
  freeform canvas returns Overview to `document` if sections exist.
- **Evidence freeform:** `evidence prepare` still prints the dir; agent writes
  either `index.html` (+ screenshots) **or** `canvas.excalidraw` (and still
  uses `evidence check` for structured pass/fail). Optional
  `evidence set --medium excalidraw --file …` convenience verb.
- **Skills own the decision tree** (companion skills, same commit as the
  feature — hard rule 4 / distribution: user-facing skills under `/skills/`):

  | Prefer **HTML** when… | Prefer **Excalidraw** when… |
  |---|---|
  | Screenshots, pass/fail reports, tables, multi-step browser proof, styled metrics | Architecture / data-flow whiteboard, box-and-arrow system map, spatial layout that prose+SVG can't carry |
  | Content already is a self-contained page (or section embeds) | Human needs to *see the shape* of the system at a glance |
  | Default for loop evidence | Default for "how the pieces connect" overview when sections alone feel flat |

  Default bias: **HTML for evidence, document/HTML for overview**; reach for
  Excalidraw only when a freeform diagram is the clearer artifact. Never both
  media on one tab for one push — pick one body.

### Schema / storage delta (overrides earlier "no schema change")

- Review set gains optional freeform canvas field (name TBD at implement:
  `canvas` / `overviewCanvas`). `thesis` + `sections` stay; freeform does not
  revive the deleted artifact channel — it's a medium on the same Review.
- Evidence stays directory-on-disk; scene is a sibling file, not a JSON blob
  in `evidence.json`. Daemon reads + validates scene size; tRPC returns
  `{ medium, html? , scene? , checks, … }`.
- Size caps + zod on both paths; reject oversize the same way as `diagram` /
  section `html`.

## Excalidraw evaluation (research — kept; rec updated)

Facts (verified on npm, 2026-07-20): `@excalidraw/excalidraw` **0.18.1**, **MIT**,
~480k weekly downloads, actively maintained. Embeds as a React component:
`<Excalidraw initialData={scene} viewModeEnabled />` for a read-only canvas.

Porcelain-specific traps (still binding for Piece 4):

1. **Fonts load from a CDN by default** (`esm.run`) — our CSP
   (`default-src 'self'; font-src 'self' data:`) blocks that, and the audit
   invariant forbids widening CSP while any agent-authored HTML can render.
   Self-hosting is MANDATORY: copy `dist/prod/fonts` into renderer assets +
   set `window.EXCALIDRAW_ASSET_PATH`. Doable, a few MB.
2. **Bundle size** (~1 MB+ gz). Renderer assets were dieted 17M→8.4M (plan 030)
   — excalidraw must be a lazy `React.lazy`/`import()` chunk that only loads
   when a medium=`excalidraw` pane mounts, with deliberate Vite chunking. The
   `optimizeDeps.entries` invariant (entries cover `src/**`) still holds since
   the lazy import site lives in `src`.
3. **React 19** — **VERIFIED** `@excalidraw/excalidraw@0.18.1` peers include
   `^19.0.0`; repo is on 19.2.x.
4. **Security shape is good:** a scene is inert JSON rendered by OUR component —
   no `dangerouslySetInnerHTML`, no iframe. Residual surfaces: element links
   (click → navigation; main's `setWindowOpenHandler` + `isSafeExternalUrl`
   gate it — verify excalidraw navigates via `window.open`) and remote image
   URLs in elements (blocked by CSP `img-src 'self' data:`; dataURLs from the
   scene's `files` map work). Net: **safer than today's inline-SVG diagrams**,
   which need the sandbox iframe.
5. **Authoring channel:** CLI file ingest + skill guidance (see Piece 4), not
   agents inventing scene JSON by hand.

Alternatives checked:
- **tldraw — REJECT.** Source-available license, mandatory "Made with tldraw"
  watermark on the free tier, paid to remove. Not for this app.
- **@xyflow/react (React Flow, MIT)** — node-graph diagrams, not a freeform
  canvas. Only interesting for auto-laid-out flow-layer graphs; list it, don't
  commit.
- **Plain HTML / structured document** — Pieces 1–3 + Overview medium
  `document`/`html`.

**Recommendation (updated):** ship Pieces 1–3 first (zero new deps, fixes both
pains), then Piece 4 (Excalidraw host + dual medium + CLI + skills) as the next
phase on the same tabbed surface — not a third tab.

## Non-goals

- No revival of the deleted feature-artifact channel/verbs; freeform canvas is
  a **medium on the Review**, not a parallel product surface.
- No new `TabKind`; the `feature` tab is reworked in place.
- Sidebar outline mechanics unchanged: flow-layer grouping, reviewed marks,
  agent NOTEs, Clear. (Outline still drives file open + section jumps when
  medium is `document`; with freeform Overview the outline stays the file map.)
- Evidence HTML path: directory-on-disk, same sandbox boundary — only placement
  moves (Piece 2) and optional Excalidraw sibling (Piece 4).
- `review-view.tsx` / `explore-view.tsx` reading-surface behavior unchanged
  (evidence split stays opt-in).
- No human annotation / edit mode on Excalidraw in v1 (`viewModeEnabled` only).
  Editable whiteboard is a later product call.
- No tldraw.

## Phases (each its own commit; `pnpm verify` gate before each)

- **A — Canvas:** Piece 1 + Piece 2 together (both define the new opening
  experience; one e2e/screenshot pass covers them). Medium is effectively
  `document` | `html` only.
- **B — Highlighting:** Piece 3. Independent; may land before A if preferred.
- **C — Excalidraw medium:** Piece 4. Self-hosted fonts, lazy chunk, scene
  validation, evidence + overview medium resolution, CLI verbs, skill decision
  tree. Hard GO criteria before merge: React 19 runtime smoke (already peer-OK),
  measured lazy-chunk cost acceptable, CSP still blocks CDN font/image loads,
  `sandbox=""` HTML path untouched.

## Verification (close-the-loop)

- **Unit:** `highlightRangesForFile` (lib test); `buildRows` evidence split;
  tabs-store merge refresh of `line`/`highlight` on re-open; medium resolution
  helpers (evidence dir file presence; review-set canvas field); scene size-cap.
- **Component** (mock domain hooks, never the tRPC proxy): FeatureList title
  affordance; FeatureView tabs (mock `useFeatureReading` / `useEvidenceHtml`);
  SourceView range tint; EvidencePanel renders `iframe sandbox=""`; Excalidraw
  host mounts with `viewModeEnabled` under mock scene (lazy boundary mocked).
- **e2e (browser project, headless Chromium):** fixture seeds a review set
  (`PORCELAIN_REVIEW_SETS`) + a loop-evidence dir. Assert: title icon visible;
  title click → canvas on Overview; Loop-evidence row → Evidence tab with the
  iframe in view WITHOUT scrolling; sidebar file click → file tab with tinted
  changed lines; evidence with scene file → Excalidraw host visible (no CDN
  font request). Element-scoped screenshot baselines (the 2% full-page
  tolerance hides narrow-column changes — earned trap).
- **Live:** dev app on the playground repo (Beelink: headless under Xvfb,
  `DISPLAY=:1 pnpm dev`, or the daemon's browser client) + computer-use
  screenshots of the dev "Electron" window. Never the installed Porcelain app.
- **Gate:** `pnpm verify` (hook-enforced).

## Docs to sync (same commit as the phase they describe — hard rule 4)

- `architecture` skill: Nomenclature "feature view" entry (document → tabbed
  canvas + medium); reading-surface note (evidence rows leave the flat list);
  `Tab` shape (`highlight`).
- `audit` skill: evidence invariant wording ("final chapter" → "Loop evidence
  tab") — state explicitly the sandbox boundary is unchanged; Excalidraw is
  inert JSON (not an iframe), self-hosted fonts, no CSP widen.
- `review-with-porcelain` + `loop-evidence` companion skills: outline ↔ canvas
  click mechanics; **when to choose HTML vs Excalidraw** decision table; CLI
  verbs for freeform canvas.
- `product` skill: Review = outline + tabbed canvas (Overview | Loop evidence),
  each tab medium agent-chosen.
- `plans/README.md`: this doc indexed as a live doc (done when placed); ship
  record written at reconcile.

## Open taste calls (recommended defaults — confirm, don't block)

1. Affordance icon: **`ArrowUpRight`** trailing the title, visible at rest.
   Alternatives: `BookOpenText`, `PanelRight`.
2. Tab names: **Overview** | **Loop evidence**.
3. Changed-line tint: `bg-diff-add/10` + 2px `bg-diff-add` gutter bar.
4. Click = file (highlighted) for ALL sources; diff moves to the context menu.
5. "More files" stays inside Overview when medium is `document`; per-source
   counts stay in the header.
6. Freeform Overview when present **replaces** the reading-surface body (outline
   still lists files/sections); no split "document under canvas" in v1.
7. Evidence: if both `index.html` and scene file exist, **HTML wins**; skills
   tell the agent to ship only one body.
