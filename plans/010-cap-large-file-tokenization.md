# Plan 010: Cap whole-file syntax tokenization so large files don't jank the renderer

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If a "STOP condition" occurs, stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/renderer/src/lib/highlight.ts src/renderer/src/components/viewer/code-line.tsx src/renderer/src/components/viewer/source-view.tsx`
> If any changed since this plan was written, compare against "Current state"; on a
> mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

Syntax highlighting tokenizes the **whole file synchronously on the renderer main
thread**. `useTokenizedLines(content, lang)` runs `tokenizeLines` →
`highlighter.codeToTokensBase(content, …)` over the **entire** content (the DOM rows
are virtualized via `VirtualRows`, but tokenization is **not**). The engine is
Shiki's **JavaScript** regex engine (the WASM engine is disabled because the CSP
forbids `wasm-unsafe-eval`), which is the slower one. And the **largest** files take
this path: `TextFileView` routes files over `EDITABLE_MAX_LINES` (5000 lines) to
`SourceView`, which has no `useDeferredValue` softening at all. So opening one big
generated file (a lockfile, a bundled JS, a schema dump — common in the 50 GB
monorepos Porcelain targets) blocks the UI for hundreds of ms to seconds. This
directly contradicts the "stays fast on a 50 GB monorepo" goal. The fix: above a
line threshold, skip tokenization and fall back to plain text (which `CodeLine`
already renders when `tokens` is null).

## Current state

`src/renderer/src/lib/highlight.ts`:
```ts
export function tokenizeLines(highlighter, code, lang): ThemedToken[][] {
  return highlighter.codeToTokensBase(code, { lang, theme: HIGHLIGHT_THEME })
}
```
(whole-file; the JS regex engine is set in `getHighlighter` precisely because the
CSP blocks WASM).

`src/renderer/src/components/viewer/code-line.tsx`:
```ts
export function useTokenizedLines(content, lang): ThemedToken[][] | null {
  const highlighter = useHighlighter()
  return useMemo(
    () => (highlighter && lang ? tokenizeLines(highlighter, content, lang) : null),
    [highlighter, lang, content],
  )
}
// CodeLine renders plain text when tokens is null/empty:
//   if (!tokens || tokens.length === 0) return <pre …>{text || ' '}</pre>
```
Both `SourceView` (`source-view.tsx:17`) and `EditorSource` (`editor-source.tsx:53`,
over `deferredContent`) call `useTokenizedLines`, so capping inside it covers both.

`text-file-view.tsx:49`: `editable = !reader && content.split('\n').length <= EDITABLE_MAX_LINES`
— files **above** 5000 lines use `SourceView` (the whole-file-tokenize path with no
defer).

## The fix

Add a pure, tested threshold helper and consult it before tokenizing:
- In `highlight.ts`, add `export const MAX_TOKENIZE_LINES = 10000` and a pure
  `export function isTokenizable(content: string): boolean` that returns
  `false` when the content has more than `MAX_TOKENIZE_LINES` lines (count `\n`
  occurrences — do not allocate a giant array if avoidable; a loop or
  `split('\n').length` is fine, it's cheap relative to tokenization).
- In `useTokenizedLines`, return `null` when `!isTokenizable(content)` so `CodeLine`
  renders plain text. Keep the existing `highlighter && lang` guard.

`MAX_TOKENIZE_LINES = 10000` keeps highlighting for every realistic source file
(source files are rarely >10k lines) while sparing the worst offenders (50k–100k
line generated files). Highlighting correctness is preserved for everything under
the cap (whole-file tokenization still carries grammar state across lines — the
reason it's whole-file; see the `tokenizeLines` doc comment). Above the cap the file
is still fully readable, just unhighlighted.

## Commands you will need

| Purpose   | Command                       | Expected on success |
|-----------|-------------------------------|---------------------|
| Tests     | `pnpm test -- highlight`      | new test passes |
| Typecheck | `pnpm typecheck`              | exit 0 |
| Lint      | `pnpm lint`                   | exit 0 |
| Full gate | `pnpm verify`                 | all four pass |

## Scope

**In scope**:
- `src/renderer/src/lib/highlight.ts` (add `MAX_TOKENIZE_LINES` + `isTokenizable`)
- `src/renderer/src/components/viewer/code-line.tsx` (consult `isTokenizable` in `useTokenizedLines`)
- `src/renderer/src/lib/highlight.test.ts` (create — for the pure helper)

**Out of scope** (do NOT touch):
- `tokenizeLines`'s whole-file behavior for content **under** the cap — do NOT switch
  to per-line tokenization (that's what broke multiline-comment highlighting; the
  whole-file approach is deliberate).
- `EDITABLE_MAX_LINES` (5000) and the editable/SourceView routing in
  `text-file-view.tsx` — unchanged.
- Moving tokenization to a worker / windowed tokenization — a larger redesign; this
  plan is the low-risk line-cap only. Note worker offload as a future option.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `perf(viewer): skip syntax highlighting above 10k lines to keep the UI responsive`.
- Do NOT push unless instructed.

## Steps

### Step 1: Add the pure threshold helper in `highlight.ts`

Add `export const MAX_TOKENIZE_LINES = 10000` and `export function isTokenizable(content: string): boolean`
returning `false` when the line count exceeds `MAX_TOKENIZE_LINES`. Add a short
comment explaining *why* (whole-file synchronous tokenization on the main thread via
the JS regex engine blocks the UI for very large files).

### Step 2: Consult it in `useTokenizedLines`

```ts
export function useTokenizedLines(content, lang): ThemedToken[][] | null {
  const highlighter = useHighlighter()
  return useMemo(
    () =>
      highlighter && lang && isTokenizable(content)
        ? tokenizeLines(highlighter, content, lang)
        : null,
    [highlighter, lang, content],
  )
}
```
Import `isTokenizable` from `@renderer/lib/highlight` (alongside the existing
`tokenizeLines` import).

### Step 3: Unit-test the pure helper

Create `src/renderer/src/lib/highlight.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isTokenizable, MAX_TOKENIZE_LINES } from './highlight'

describe('isTokenizable', () => {
  it('allows normal-sized files', () => {
    expect(isTokenizable('a\n'.repeat(100))).toBe(true)
    expect(isTokenizable('')).toBe(true)
  })
  it('blocks files past the cap', () => {
    expect(isTokenizable('a\n'.repeat(MAX_TOKENIZE_LINES + 1))).toBe(false)
  })
})
```
(`isTokenizable` is pure and has no Shiki dependency, so this test does not need the
highlighter to load.)

**Verify**: `pnpm test -- highlight` → passes.

### Step 4: Full gate

**Verify**: `pnpm verify` → all four pass.

## Test plan

- `highlight.test.ts`: `isTokenizable` true under the cap (incl. empty), false above
  it.
- Verification: `pnpm test -- highlight` → pass.
- Optional manual check (not required): open a >10k-line file (e.g. `pnpm-lock.yaml`
  in a checked-out repo) in the dev app and confirm it opens instantly as plain text
  rather than freezing the UI; a normal source file is still highlighted.

## Done criteria

ALL must hold:

- [ ] `highlight.ts` exports `MAX_TOKENIZE_LINES` and `isTokenizable`
- [ ] `useTokenizedLines` returns `null` (plain text) for content above the cap
- [ ] `highlight.test.ts` exists and passes
- [ ] `pnpm verify` passes
- [ ] Only the three in-scope files are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `CodeLine`'s null/empty-tokens fallback no longer renders plain text (the contract
  this fix relies on changed) — report it.
- A realistic source file you care about exceeds 10k lines and loses highlighting and
  that's unacceptable — report so the threshold (or a char-based cap) can be
  reconsidered; don't silently raise it without flagging.

## Maintenance notes

- If highlighting is later moved off-thread (a worker) or made windowed with
  grammar-state checkpoints, this cap can be raised or removed — record that as the
  proper fix; this is the pragmatic guard.
- A char-count cap (e.g. a file with few but enormous lines) is a possible
  refinement; line count covers the common generated-file case. Note it if you see a
  pathological minified file slip under the line cap.
- A reviewer should confirm normal files still highlight (the cap is high) and that
  the cap helper is pure/tested.
