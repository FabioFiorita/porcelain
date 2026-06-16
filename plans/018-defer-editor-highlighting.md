# Plan 018: Decouple editor syntax highlighting from keystroke latency

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1f8d02..HEAD -- src/renderer/src/components/viewer/editor-source.tsx src/renderer/src/components/viewer/code-line.tsx`
> If either changed since this plan was written, compare the "Current state"
> excerpts against the live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Category**: perf
- **Depends on**: none
- **Planned at**: commit `e1f8d02`, 2026-06-16

## Why this matters

The in-place text editor re-tokenizes the **entire file** with Shiki on **every
keystroke**: `useTokenizedLines(content, lang)` is keyed on `content`, and
`content` updates on every `onChange`, so each keypress synchronously runs
`tokenizeLines(highlighter, WHOLE_FILE, lang)` on the render thread. On a large
editable file (allowed up to `EDITABLE_MAX_LINES = 5000`), that whole-file
tokenization is tens of milliseconds per keystroke, run inside the keystroke's
render — so typing visibly lags and drops frames, scaling with file size rather
than edit size. This is the heaviest interactive hot path in the app.

After this plan, the textarea stays bound to the live `content` (input latency is
unchanged and instant), while the **colored backdrop** is tokenized from a
deferred copy of the content via React's `useDeferredValue`. During fast typing the
colors trail by a frame (and untokenized lines fall back to readable plain text);
typing latency decouples from file size. No alignment risk, because the backdrop's
line structure still maps over the live `content` — only the token colors lag.

## Current state

`EditorSource` in `src/renderer/src/components/viewer/editor-source.tsx`:

- Imports (line 25): `import { memo, useEffect, useRef, useState } from 'react'`
- State + tokenization (lines 45, 52):

  ```ts
  const [content, setContent] = useState(initialContent)
  …
  const tokenLines = useTokenizedLines(content, lang)   // ← re-runs every keystroke
  ```

- `edit(next)` calls `setContent(next)` on every change (line 64-70).
- The aria-hidden colored backdrop maps over `content` and indexes `tokenLines`
  per line (lines 133-141):

  ```tsx
  {content.split('\n').map((line, i) => (
    <div key={i} className={cn('flex', i + 1 === highlightLine && 'bg-primary/15')}>
      <span className="w-10 …">{i + 1}</span>
      <EditorLine tokens={tokenLines?.[i] ?? null} text={line} />
    </div>
  ))}
  ```

- The textarea (lines 144-158) is `value={content}` with transparent text; it owns
  the caret/selection over the backdrop colors.

`useTokenizedLines` (`src/renderer/src/components/viewer/code-line.tsx:30-39`)
memoizes on `[highlighter, lang, content]` and returns `ThemedToken[][] | null`;
`CodeLine` renders plain `text` when its `tokens` arg is null/empty (line 50-51) —
so a line with not-yet-ready tokens degrades to readable plain text, not blank.

`useDeferredValue` is a built-in React 19 hook (the repo is on React 19.2).

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Install   | `pnpm install`   | exit 0              |
| Typecheck | `pnpm typecheck` | exit 0              |
| Test (all) | `pnpm test`     | all pass            |
| Lint      | `pnpm lint`      | exit 0              |
| Build     | `pnpm build`     | exit 0              |

## Scope

**In scope**:
- `src/renderer/src/components/viewer/editor-source.tsx` — defer the tokenization
  input.

**Out of scope** (do NOT touch):
- `code-line.tsx` / `useTokenizedLines` — its memo + plain-text fallback already
  do the right thing.
- The textarea's `value={content}` binding — it MUST stay live so input latency is
  untouched.
- The backdrop's `content.split('\n').map(...)` line structure — it MUST stay on
  live `content` so the backdrop's line count always matches the textarea (only
  the token colors may lag).
- The autosave/debounce logic, the single-scroll-container layout, the
  `EDITABLE_MAX_LINES` threshold — all unchanged.

## Git workflow

Per `CLAUDE.md` hard rule 8, **commit straight to `main` — never branch**. Run the
full gate before committing. Conventional Commits; example:
`perf(editor): defer syntax highlighting so typing latency is file-size-independent`.

## Steps

### Step 1: Defer the tokenization input

In `src/renderer/src/components/viewer/editor-source.tsx`:

- Add `useDeferredValue` to the React import:

  ```ts
  import { memo, useDeferredValue, useEffect, useRef, useState } from 'react'
  ```

- Tokenize from a deferred copy of `content`, leaving the textarea and backdrop
  text on the live `content`:

  ```ts
  const [content, setContent] = useState(initialContent)
  …
  const deferredContent = useDeferredValue(content)
  const tokenLines = useTokenizedLines(deferredContent, lang)
  ```

Leave the backdrop's `content.split('\n').map(...)` exactly as-is (it stays on live
`content`). The `tokenLines?.[i] ?? null` fallback already handles a momentarily
missing/stale token line by rendering plain text.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Run the full gate

**Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → all exit 0.

### Step 3 (optional manual perf check)

If you can run the app: `pnpm dev`, open a large file (~1000+ lines) in the editor,
and type rapidly — input should stay responsive with the colors settling a frame
behind. Not required for done (the repo has no editor perf test harness).

## Test plan

- This is a rendering-performance change with no new pure logic; the editor has no
  unit test today and the change preserves all observable output (the colored
  result is identical once the deferred value settles).
- Verification is the full gate passing plus the grep done-criterion that
  `useDeferredValue` feeds `useTokenizedLines`.
- Do NOT add a flaky timing-based test; `useDeferredValue` behavior isn't
  meaningfully assertable in jsdom.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -n "useDeferredValue" src/renderer/src/components/viewer/editor-source.tsx`
      shows it wrapping the content fed to `useTokenizedLines`
- [ ] The textarea is still `value={content}` (live) and the backdrop still maps
      over live `content` (only the tokens use the deferred value)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The backdrop or textarea no longer matches the "Current state" excerpt (the
  single-scroll-container design changed) — deferring could interact with a
  different layout, so re-confirm before proceeding.
- Deferring the tokens visibly mis-aligns colors with text beyond a transient
  frame (it should not, since the backdrop text stays live) — report what you see.

## Maintenance notes

- For the reviewer: confirm ONLY the tokenization input is deferred — the textarea
  `value` and the backdrop's `.split('\n')` line mapping must stay on live
  `content`, or the caret/selection could drift from the colors (the bug the
  single-scroll-container design was built to avoid).
- A larger follow-up (separately scoped, not this plan): the editor backdrop
  renders all lines unvirtualized up to 5000 — virtualizing it, or lowering
  `EDITABLE_MAX_LINES`, would cut the DOM cost too. Deferring highlighting is the
  high-leverage, low-risk first step.
