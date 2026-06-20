# Plan 008: Tests for the feature-slice heuristic (malformed input) and the keyboard predicates

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If a "STOP condition" occurs, stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b224765..HEAD -- src/main/feature-slice.ts src/main/feature-slice.test.ts src/renderer/src/lib/keyboard.ts`
> If any changed since this plan was written, compare against "Current state"; on a
> mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `b224765`, 2026-06-20

## Why this matters

Two pure, high-clarity modules have dangerous coverage gaps:

1. **`feature-slice.ts` is the engine behind the feature-review "story"** (it slices
   an unchanged file down to just the symbols the feature imports). Its `spanEnd`
   does naive brace/paren/bracket depth counting that a brace inside a string or
   comment can skew, and it **fails open** — when it locates nothing it returns the
   whole file (capped), so a mis-slice degrades *silently* (the reviewer reads the
   wrong lines believing they're the whole symbol). The existing tests only cover
   well-formed TypeScript; the adversarial inputs the code's own comments warn about
   are untested.

2. **`keyboard.ts`'s `isTextEntry`/`isTerminalTarget`** gate the **destructive**
   Files shortcuts (⌘D duplicate, ⌘⌫ trash). They form a deliberate asymmetric pair
   (`isTextEntry` *excludes* `.xterm` so ⌘T still spawns; `isTerminalTarget` *matches*
   `.xterm` so ⌘⌫ does **not** trash a file when the terminal is focused). A one-line
   refactor that inverts either predicate would make ⌘⌫ trash a file while the user
   meant to delete a shell line. They are pure DOM predicates with **zero** tests.

These tests are cheap, pure (no I/O), and pin behavior that fails silently/dangerously.

## Current state

`src/main/feature-slice.ts` — the relevant pieces:
- `sliceSource(source: string, symbols: ReadonlySet<string>): FileSlice` (line ~175)
  — the public entry. `symbols.size === 0 || symbols.has('*')` ⇒ "all exports".
  When `spans.length === 0` it returns `{ ranges:[whole file capped at FALLBACK_LINES=200], whole:true }`.
- `spanEnd(lines, decl)` (line ~136) — depth counts `{}()[]`; a continuation regex
  `/[=|&,(<+]$/` (and `extends|implements$`) extends brace-less multi-line forms;
  bounded by `MAX_SYMBOL_LINES = 80`.
- `declNameAt(line)` (line ~109) — returns the export's name, `null` for
  `export default` (anonymous), `undefined` for a non-export line. `DECL_PATTERNS`
  match `export default|function|class|const|let|var|type|interface|enum|{`.
- `MAX_TOTAL_LINES = 400`, `MERGE_GAP = 2`.

`src/main/feature-slice.test.ts` already exists (~11 cases over well-formed TS) —
use it as the structural exemplar for new cases (same imports, `describe`/`it`).

`src/renderer/src/lib/keyboard.ts` (whole file, ~21 lines):
- `isTextEntry(target)` — `false` if `target.closest('.xterm')`; else true for
  contentEditable / INPUT / TEXTAREA.
- `isTerminalTarget(target)` — true iff `target instanceof HTMLElement` and
  `target.closest('.xterm') !== null`.
There is no `keyboard.test.ts` today.

## Commands you will need

| Purpose   | Command                                 | Expected on success |
|-----------|-----------------------------------------|---------------------|
| Tests     | `pnpm test -- feature-slice keyboard`   | all pass, new cases included |
| Typecheck | `pnpm typecheck`                        | exit 0 |
| Lint      | `pnpm lint`                             | exit 0 |
| Full gate | `pnpm verify`                           | all four pass |

## Scope

**In scope** (tests only):
- `src/main/feature-slice.test.ts` (add adversarial cases)
- `src/renderer/src/lib/keyboard.test.ts` (create)

**Out of scope** (do NOT touch):
- `src/main/feature-slice.ts` and `src/renderer/src/lib/keyboard.ts` — **do not
  change the implementation**. These are characterization tests: they pin *current*
  behavior. If a test reveals a genuine slicing bug (a span bleeding into the next
  symbol), STOP and report it rather than "fixing" it here — that's a separate
  decision.
- Any other module.

## Git workflow

- Commit straight to `main`; do not branch.
- Conventional Commits, e.g. `test(feature-slice,keyboard): cover malformed input + the .xterm carve-out`.
- Do NOT push unless instructed.

## Steps

### Step 1: Add adversarial `sliceSource` cases

In `feature-slice.test.ts`, add cases (assert on the returned `ranges`/`whole`/
`truncated`, capturing *current* behavior — run them first to see what the code
actually does, then encode that):
- **Brace inside a string literal**: e.g.
  `export const s = "}"\nexport const after = 1\n` requesting `{'after'}` — assert
  the `after` range does **not** swallow following symbols (or document the actual
  span if `spanEnd` miscounts — the point is to pin behavior so a future change is
  visible).
- **Symbol exceeding `MAX_SYMBOL_LINES`**: a function whose body is >80 lines —
  assert the returned span is capped (length ≤ `MAX_SYMBOL_LINES`).
- **Anonymous `export default`**: `export default () => {}\n` with an empty symbol
  set ("all exports") — assert the default's range is included (`declNameAt` returns
  `null`, and the `name !== null` guard in `sliceSource` lets a null-named decl
  through when `allExports`). Confirm the `whole` flag is `false` (a span was found).
- **No exports at all**: a file with only non-export statements — assert
  `whole === true` and the range is the file capped at 200 lines.

### Step 2: Create `keyboard.test.ts`

Create `src/renderer/src/lib/keyboard.test.ts` (jsdom env is the default — see
`vitest.config.ts`). Build elements with `document.createElement` / set
`innerHTML`, and assert:
- `isTextEntry`: true for `<input>`, `<textarea>`, and a `contentEditable` element;
  false for a plain `<div>`; **false** for an element inside `.xterm` (e.g. a
  `<textarea>` nested under `<div class="xterm">`); false for `null`.
- `isTerminalTarget`: true for an element inside `.xterm`; false for a plain element
  and for `null`.
- The asymmetry: for a `<textarea>` inside `.xterm`, `isTextEntry` is **false** and
  `isTerminalTarget` is **true** (the carve-out that lets ⌘T spawn but stops ⌘⌫ from
  trashing).

Sketch:
```ts
import { expect, test } from 'vitest'
import { isTerminalTarget, isTextEntry } from './keyboard'

function inXterm(tag: string): HTMLElement {
  const host = document.createElement('div')
  host.className = 'xterm'
  const el = document.createElement(tag)
  host.appendChild(el)
  document.body.appendChild(host)
  return el
}

test('isTextEntry: true for fields, false inside .xterm', () => {
  const input = document.createElement('input')
  expect(isTextEntry(input)).toBe(true)
  expect(isTextEntry(inXterm('textarea'))).toBe(false)
  expect(isTextEntry(document.createElement('div'))).toBe(false)
  expect(isTextEntry(null)).toBe(false)
})

test('isTerminalTarget is the .xterm inverse', () => {
  expect(isTerminalTarget(inXterm('textarea'))).toBe(true)
  expect(isTerminalTarget(document.createElement('div'))).toBe(false)
  expect(isTerminalTarget(null)).toBe(false)
})
```

**Verify**: `pnpm test -- feature-slice keyboard` → all pass.

### Step 3: Full gate

**Verify**: `pnpm verify` → all four pass.

## Test plan

- `feature-slice.test.ts`: brace-in-string, `MAX_SYMBOL_LINES` overflow, anonymous
  default export, no-exports fallback (Step 1).
- `keyboard.test.ts`: the predicate truth table incl. the `.xterm` asymmetry (Step 2).
- Verification: `pnpm test -- feature-slice keyboard` → all pass.

## Done criteria

ALL must hold:

- [ ] `feature-slice.test.ts` has the four new adversarial cases and they pass
- [ ] `keyboard.test.ts` exists and covers `isTextEntry`/`isTerminalTarget` incl. the
      `.xterm` carve-out, and passes
- [ ] `feature-slice.ts` and `keyboard.ts` are **unmodified**
- [ ] `pnpm verify` passes
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- A `sliceSource` case reveals a span that bleeds into the next symbol or otherwise
  looks like a real bug (not just "capped as expected") — report it; do not change
  the implementation to make a test pass.
- `isTextEntry`/`isTerminalTarget` behave differently from the truth table above —
  report the actual behavior; the test should encode reality, but a surprising
  result is worth surfacing.

## Maintenance notes

- These are characterization tests: if `spanEnd`'s heuristic is intentionally
  improved later (e.g. to skip braces inside strings), update the brace-in-string
  case to the new expected behavior in the same commit.
- The keyboard pair's asymmetry is load-bearing for the destructive-shortcut safety
  (`.agents/skills/architecture/SKILL.md` "Keyboard shortcuts"). A reviewer touching
  `keyboard.ts` should run these tests first.
