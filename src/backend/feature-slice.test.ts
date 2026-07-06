import { describe, expect, it } from 'vitest'
import { collectImportedSymbols, parseImportBindings, sliceSource } from './feature-slice'

describe('parseImportBindings', () => {
  it('captures named imports by their original (imported) name', () => {
    expect(parseImportBindings("import { a, b as c } from './x'")).toEqual([
      { spec: './x', names: ['a', 'b'] },
    ])
  })

  it('captures default and mixed default+named imports', () => {
    expect(parseImportBindings("import Def from './x'")).toEqual([
      { spec: './x', names: ['default'] },
    ])
    expect(parseImportBindings("import Def, { a } from './x'")).toEqual([
      { spec: './x', names: ['a', 'default'] },
    ])
  })

  it('flags a namespace import and an `export *` re-export with *', () => {
    expect(parseImportBindings("import * as ns from './x'")).toEqual([
      { spec: './x', names: ['*'] },
    ])
    expect(parseImportBindings("export * from './x'")).toEqual([{ spec: './x', names: ['*'] }])
  })

  it('strips a leading `type` and captures re-exported names', () => {
    expect(parseImportBindings("import { type A, b } from './x'")).toEqual([
      { spec: './x', names: ['A', 'b'] },
    ])
    expect(parseImportBindings("export { foo } from './x'")).toEqual([
      { spec: './x', names: ['foo'] },
    ])
  })

  it('does not let a preceding side-effect import pollute the next binding', () => {
    // the bug the [^'"] clause guards against: lazily crossing './a' to find `from`
    expect(parseImportBindings("import './a'\nimport Def from './c'")).toEqual([
      { spec: './c', names: ['default'] },
    ])
  })
})

describe('collectImportedSymbols', () => {
  it('unions the names every importer pulls from the target, via the resolver', () => {
    const sources = new Map([
      ['page.tsx', "import { greet } from './svc'\nimport { TEMPLATES } from './svc'"],
      ['hook.ts', "import { greet, other } from './svc'"],
      ['unrelated.ts', "import { x } from './elsewhere'"],
    ])
    // resolver: every './svc' spec points at svc.ts; anything else is out of view
    const resolve = (spec: string): string | null => (spec === './svc' ? 'svc.ts' : null)
    const symbols = collectImportedSymbols('svc.ts', sources, resolve)
    expect([...symbols].sort()).toEqual(['TEMPLATES', 'greet', 'other'])
  })
})

const SOURCE = `// header comment
import { helper } from './helper'

/** Greet a user by name. */
export function greet(name: string): string {
  return \`Hello, \${name}\`
}

const internal = 1

export const TEMPLATES = {
  a: 1,
  b: 2,
}

export type Mode = 'on' | 'off'
`

describe('sliceSource', () => {
  it('slices to a named symbol, including its leading doc comment', () => {
    const slice = sliceSource(SOURCE, new Set(['greet']))
    expect(slice.whole).toBe(false)
    expect(slice.ranges).toHaveLength(1)
    const [range] = slice.ranges
    expect(range.startLine).toBe(4) // the /** */ doc line, not the `export function`
    expect(range.lines.join('\n')).toContain('export function greet')
    expect(range.lines.join('\n')).toContain('return `Hello')
    // the closing brace is the last line; `const internal` is not included
    expect(range.lines.join('\n')).not.toContain('internal')
  })

  it('captures a brace-balanced multi-line object const', () => {
    const slice = sliceSource(SOURCE, new Set(['TEMPLATES']))
    expect(slice.ranges).toHaveLength(1)
    const body = slice.ranges[0].lines.join('\n')
    expect(body).toContain('export const TEMPLATES = {')
    expect(body).toContain('b: 2,')
    expect(body.trimEnd().endsWith('}')).toBe(true)
  })

  it('falls back to every export when the symbol set is empty or has *', () => {
    const all = sliceSource(SOURCE, new Set())
    const text = all.ranges.flatMap((r) => r.lines).join('\n')
    expect(text).toContain('export function greet')
    expect(text).toContain('export const TEMPLATES')
    expect(text).toContain('export type Mode')
    expect(text).not.toContain('const internal') // non-exported, skipped
    expect(sliceSource(SOURCE, new Set(['*'])).ranges.length).toBe(all.ranges.length)
  })

  it('records the elided line count before each range', () => {
    const slice = sliceSource(SOURCE, new Set(['greet', 'Mode']))
    expect(slice.ranges).toHaveLength(2)
    // first range starts at line 4 → 3 lines elided before it (1-3)
    expect(slice.ranges[0].gapBefore).toBe(3)
    // there is a real gap between greet's close and the Mode declaration
    expect(slice.ranges[1].gapBefore).toBeGreaterThan(0)
  })

  it('falls back to the whole file when no symbol is located', () => {
    const slice = sliceSource('const a = 1\nconst b = 2\n', new Set(['nope']))
    expect(slice.whole).toBe(true)
    expect(slice.ranges).toHaveLength(1)
    expect(slice.ranges[0].lines).toEqual(['const a = 1', 'const b = 2'])
  })

  // Adversarial: brace inside a string literal
  // The `"}"` on the first line decrements depth before it's been incremented, but
  // spanEnd still exits at depth ≤ 0 on the same single-line const — so the `after`
  // symbol is NOT swallowed. Pin that correct boundary behavior.
  it('brace inside a string literal does not cause the next symbol to bleed in', () => {
    const src = 'export const s = "}"\nexport const after = 1\n'
    const slice = sliceSource(src, new Set(['after']))
    expect(slice.whole).toBe(false)
    expect(slice.ranges).toHaveLength(1)
    // Only `after`'s line — `s` is not included
    const body = slice.ranges[0].lines.join('\n')
    expect(body).toContain('export const after = 1')
    expect(body).not.toContain('export const s')
  })

  // Adversarial: brace inside a comment
  // spanEnd counts characters literally, so a `{` inside a `//` comment inflates
  // depth and prevents early exit — the span runs to MAX_SYMBOL_LINES (80) and the
  // symbol after it bleeds in. This pins the current (known-imperfect) behavior so a
  // future fix is visible. The comment in spanEnd itself warns about this.
  it('brace inside a comment skews depth and bleeds into following symbols (pinned fail-open behavior)', () => {
    // Line 0: decl opens with `{` (depth 1); the inline comment adds another `{` (depth 2)
    // Line 1: value line — no braces, depth stays 2
    // Line 2: closing `}` — depth 1; still > 0, so spanEnd continues
    // Lines 3+: `after` and beyond get swallowed until MAX_SYMBOL_LINES cap
    const src = `${[
      'export const a = { // { extra brace in comment',
      '  x: 1',
      '}',
      'export const after = 1',
    ].join('\n')}\n`
    const slice = sliceSource(src, new Set(['a']))
    expect(slice.whole).toBe(false)
    // Because the comment-brace inflates depth, `after` bleeds into `a`'s span
    const body = slice.ranges[0].lines.join('\n')
    expect(body).toContain('export const a =')
    // Pin the bleed: `after` is included in `a`'s span due to the comment-brace skew
    expect(body).toContain('export const after = 1')
  })

  // Adversarial: a symbol whose body exceeds MAX_SYMBOL_LINES (80)
  // spanEnd's loop is bounded at decl + MAX_SYMBOL_LINES, so the returned range
  // can be at most MAX_SYMBOL_LINES lines long — the truncation is silent but bounded.
  it('caps a symbol whose body exceeds MAX_SYMBOL_LINES', () => {
    const MAX_SYMBOL_LINES = 80
    const bodyLines = Array.from({ length: 100 }, (_, i) => `  const x${i} = ${i}`)
    const src = `${['export function big() {', ...bodyLines, '}'].join('\n')}\n`
    const slice = sliceSource(src, new Set(['big']))
    expect(slice.whole).toBe(false)
    expect(slice.ranges).toHaveLength(1)
    // The span is capped — it cannot exceed MAX_SYMBOL_LINES lines
    expect(slice.ranges[0].lines.length).toBeLessThanOrEqual(MAX_SYMBOL_LINES)
  })

  // Adversarial: anonymous `export default` — declNameAt returns null, not undefined.
  // In allExports mode (empty symbol set), the `name !== null` guard is skipped so the
  // default's span IS included. `whole` must be false (a span was found).
  it('includes an anonymous export default when requesting all exports', () => {
    const src = 'export default () => {}\n'
    const slice = sliceSource(src, new Set())
    expect(slice.whole).toBe(false)
    expect(slice.ranges).toHaveLength(1)
    const body = slice.ranges[0].lines.join('\n')
    expect(body).toContain('export default')
  })

  // Adversarial: no exports at all — falls back to the whole file, capped at FALLBACK_LINES (200)
  it('returns whole === true and the full content when the file has no exports', () => {
    const src = 'const hidden = 1\nfunction internal() { return 2 }\n'
    const slice = sliceSource(src, new Set(['hidden']))
    expect(slice.whole).toBe(true)
    expect(slice.ranges).toHaveLength(1)
    const body = slice.ranges[0].lines.join('\n')
    expect(body).toContain('const hidden = 1')
    expect(body).toContain('function internal')
  })
})
