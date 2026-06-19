# Porcelain — Codebase Quality Audit

> Generated review across Performance, Security, Design, Scalability, and Clean Code.
> Snapshot: `0.12.0` (`7a794f7`), ~18.7k LOC source, 49 test files.

## Headline

This is a high-quality, unusually disciplined codebase. Strict TS with **zero**
`any` / `as unknown as` / `@ts-ignore` (outside one unavoidable preload `.d.ts`),
no TODO/FIXME debt, atomic config writes, zod-validated IPC inputs, a fully
tokenized design system, and architecture rules enforced *in lint* rather than
prose. The findings below are mostly **medium/low polish and consistency** items,
not fires. Each has a `file:line` anchor so it is directly actionable.

Severity legend: **High** = fix soon · **Medium** = worth doing · **Low** = polish.

---

## 1. Performance

Baseline is strong: virtualized file/diff rendering, lazy per-dir tree reads,
stale-while-revalidate `ls-files`, flow caches keyed on status+numstat+layers,
directory-scoped file watching (not recursive), resize handles that write CSS vars
during drag and commit to the store only on mouseup. The 3s/5s polls are deliberate.

| # | Severity | Finding | Location |
|---|---|---|---|
| P1 | Medium | **List rows are essentially unmemoized** — `React.memo` appears exactly once in the entire renderer. `FileRow`, `FlowNode`, `TreeNode`, search rows etc. re-render wholesale whenever the parent does (and parents re-render on every 3s flow poll). Highest runtime cost on large change sets / deep trees. | `changes-list.tsx:320`, `feature-list.tsx:268`, `tree-node.tsx:323` |
| P2 | Medium | **`git merge-base` is recomputed redundantly.** `gitRangeFlow` calls `gitDefaultBranch` then `gitRangeChangedFiles` + `gitRangeNumstat`, and each of those re-runs `gitMergeBase` — 2 extra git spawns per range-flow build. `gitRangeDiffFile` recomputes it on every file open. Compute once and thread `mergeBase` through. | `git.ts:524,536,566` |
| P3 | Low | **Module-global caches never evict** (`flowCache`, `rangeFlowCache`, `featureViewCache`, `featureReadingCache`, `fileListCache`, `searchListCache`, `searchCandidatesCache`). One entry per repo opened, for the process lifetime. Negligible for a desktop app but unbounded; an LRU cap would make it principled. | `api.ts:160-175`, `git.ts:41,80` |
| P4 | Low | Inline handler/object props in mapped rows (e.g. the `openTab({...})` literal per row) are fine today but become real re-render triggers the moment P1 lands — wrap in `useCallback` when memoizing rows. | `changes-list.tsx:107-115`, `feature-list.tsx:50-57` |

---

## 2. Security

Baseline is strong: `execFile`/`spawn` with arg arrays everywhere (no shell string
interpolation), git commands are a whitelist (`QUICK_COMMANDS`) or fixed templates,
external URLs gated by `isSafeExternalUrl`, agent-supplied review-set paths
re-validated + repo-contained on read, `readFile` capped at 10 MB, the plugin
installer takes no renderer input, MCP channels are stdio-only (no inbound network).
All tRPC inputs are zod-validated.

| # | Severity | Finding | Location |
|---|---|---|---|
| S1 | Medium (defense-in-depth) | **No Content-Security-Policy** on the renderer. Agent/human-authored markdown (`react-markdown`), review comments, and notes are rendered. react-markdown emits no raw HTML by default so there's no *known* injection, but a CSP (`default-src 'self'`, no `unsafe-eval` in prod) turns "no known XSS" into "XSS can't reach a primitive." | renderer `index.html` / `window.ts:51` |
| S2 | Medium (defense-in-depth) | **fs procedures accept arbitrary absolute paths with no repo-containment check** — `readFile`, `writeTextFile`, `createFile`, `createFolder`, `renamePath`, `duplicatePath`, `trashPath`, `readDir`. Acceptable under the trusted-renderer model, but it means any renderer-side injection (see S1) escalates to arbitrary file read/write/trash. A lightweight guard on the path-taking mutations would harden it. | `api.ts:472-545,572-578` |
| S3 | Low | **`webPreferences` doesn't set `contextIsolation: true` explicitly** (relies on the Electron default) and sets **`sandbox: false`**. The preload only uses `ipcRenderer`/`contextBridge`, which work under the sandbox — consider enabling it and making `contextIsolation` explicit so a future Electron default change can't silently weaken the boundary. | `window.ts:51-57` |
| S4 | Low | **Argument-injection hardening on `gitCheckout`.** `git checkout <branch>` has no `--` guard and `branch` is `z.string()`; a value like `-B`/`--orphan` would be read as a flag. Not currently reachable (inputs come from the real branch list), but the other git helpers already use `--` — `gitCheckout` is the odd one out. | `git.ts:243` |

---

## 3. Design (UI / design system)

Strongest area. `main.css` is an exemplary tokenized system: dual-theme
(`:root` + `.dark`) for every semantic/diff/ink color even though only dark ships,
a documented glaze material language, `prefers-reduced-motion` honored, focus rings
routed through `outline` to survive box-shadow chips, with inline rationale.
shadcn-primitives-only is a hard rule.

| # | Severity | Finding | Location |
|---|---|---|---|
| D1 | Medium | **Arbitrary font-size literals aren't tokenized.** `text-[13px]` (~28×) and `text-[10px]` (~41×), plus one-offs `text-[8.5px]`, `text-[9px]`, `text-[11px]`. Given how thoroughly colors are tokenized, the type scale is the conspicuous gap — promote these to named theme sizes so the scale is the single source of truth. | repo-wide; e.g. `feature-list.tsx:83`, `search-list.tsx:129` |
| D2 | Low | **Undocumented magic geometry** for the flow "spine": `size-[7px]`, `left-[3px]`, `left-[7px]` — the `7px` appears as both marker size and spine offset with no shared variable, so the alignment relationship is implicit and fragile under restyle. Extract to a CSS var. | `feature-list.tsx:24,62,266` |

Overall design verdict: **excellent and intentional.** D1 is the only real gap.

---

## 4. Scalability

Runtime scaling on big repos is already well-handled (bounded reads: `slice(0, 200)`
+ 1 MB/file caps; lazy indexing). These items are about how the **code** scales as
features/channels/procedures are added.

| # | Severity | Finding | Location |
|---|---|---|---|
| SC1 | Medium | **The four agent-channel stores are near-identical copies.** `comment-store`, `board-store`, `actions-store`, `notes-store` each hand-roll the same `readAll`/`writeAll` (mkdir + tmp + rename) + serialized `mutate`/`chain` + `*Path()` env-override block — ~40 duplicated lines ×4. A `createHomeChannel<T>({ envVar, file, schema })` factory (sibling to `createJsonStore`, but fresh-read + `Record<repoPath, T[]>` shaped) would collapse all four and make the next channel trivial + uniform. Biggest DRY/scalability item in the codebase. | `comment-store.ts:58-89`, `board-store.ts:185-214`, `actions-store.ts:403-432`, `notes-store.ts:298-329` |
| SC2 | Medium | **`api.ts` is a 986-line monolith** holding every procedure plus 4 module-level caches plus helpers. Still reads cleanly, but it's the one file that grows with every feature. Splitting into composed sub-routers (`gitRouter`, `boardRouter`, `featureRouter`, `fsRouter`, …) merged via `t.router({...})` localizes change and keeps `AppRouter` inference intact. | `api.ts` |
| SC3 | Low | **`gitFlow` and `gitRangeFlow` procedures are ~90% duplicated** (the `files.slice(0,200)` source-read loop + `statByPath` + `buildFlow` mapping appears 3× counting `readSourcesInto`). Factor the "read sources → build flow groups with stats" pipeline into one helper. | `api.ts:584-657` |
| SC4 | Low | Agent channels re-read + zod-parse the entire all-repos-in-one-file JSON on every query (correct for cross-process freshness). Fine now; at many-repos × many-cards scale it's a full parse per poll. Noting the growth shape. | `*-store.ts readAll()` |

---

## 5. Clean Code

Already exemplary on the macro rules (naming, one-public-component-per-file,
explicit return types, no dead-code lint debt). Remaining items are localized repetition.

| # | Severity | Finding | Location |
|---|---|---|---|
| C1 | Medium | **Basename/dirname is reimplemented inline 17× across 7 components** (`split('/').at(-1)`, `split('/').slice(0,-1).join('/')`, `lastIndexOf('/')`) — and `lib/paths.ts` already exists with `relativeTo` but no `fileName`/`dirName`. Add `fileName(path)` / `dirName(path)` there and replace the call sites (also standardizes on the efficient `lastIndexOf` form). | `changes-list.tsx`, `feature-list.tsx`, `search-list.tsx`, `file-finder.tsx`, `comments-group.tsx`, `content-search.tsx`, `search-view.tsx` |
| C2 | Medium | **The `try { await runGit(...) } catch (e) { throw new Error(gitErrorOutput(e)) }` wrapper is copy-pasted ~10×** across the mutating git helpers. A `runGitChecked(repo, args)` doing the try/catch once removes the repetition and guarantees uniform error surfacing. | `git.ts:242-344` |
| C3 | Low | **`useSetRepoLayers`'s internal `save` takes a `repoPath?` parameter that's never used** — the caller re-reads `useRepoStore.getState().repo?.path`. Dead parameter; drop it. | `use-repo-layers.ts:17` |
| C4 | Low | **3 components exceed ~330 lines** by inlining a large sub-component (`FileRow` in changes-list, `DirNode`/`EntryContextMenu` in tree-node, the editor in flow-layers-section). Extracting the row/node sub-components into their own files is also the natural place to add the P1 memo. | `changes-list.tsx`, `tree-node.tsx`, `flow-layers-section.tsx` |
| C5 | Low | **Implicit query `staleTime`.** ~12 read-only query hooks rely entirely on the global 30s default with no local declaration, slightly undercutting the architecture's own "query options live in the hook" principle. Even a one-line explicit `staleTime` (or a comment for externally-invalidated ones like `useReadFile`) makes freshness intent self-documenting. | `use-files.ts:22`, `use-comments.ts:8`, `use-board.ts:21`, `use-actions.ts:10`, … |

---

## Test coverage note

Most logic lives main-side and is well-tested (36 of 49 test files are main/lib unit
tests; parsers, stores, flow, fuzzy, conventions all covered). Gaps:

- **Hooks: 0 tests** — acceptable; they're thin wrappers covered indirectly via component tests.
- **Components: 9/64 tested** — the critical lists are covered (changes/feature/search/history/reading-surface); most others aren't. Matches the documented "push logic main-side" strategy, so a deliberate trade-off.
- `lib/keyboard.ts` predicates (`isTextEntry`/`isTerminalTarget`) are pure and untested — cheap, high-clarity tests to add.

---

## Recommended priority order

1. **C1 + C2** — extract `paths.ts` helpers + `runGitChecked`. Highest value-to-effort; removes the most duplication.
2. **SC1** — shared agent-channel factory. Biggest structural DRY win; pays off on the next channel.
3. **P1** — memoize list rows. Best runtime win; pairs naturally with C4.
4. **P2** — single merge-base. Easy correctness/perf.
5. **S1 + S2** — CSP + path-containment guard. Cheap defense-in-depth.
6. **D1** — tokenize the type scale. Closes the one real design-system gap.
7. **SC2 / SC3** — split `api.ts`, share the flow pipeline. When `api.ts` next grows.

None block anything; the codebase is in strong shape. C1/C2/SC1 are mechanical,
well-bounded, and fully covered by the existing verification gate
(`pnpm lint && pnpm typecheck && pnpm test && pnpm build`) — the natural starting point.
