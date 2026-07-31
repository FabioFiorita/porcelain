#!/usr/bin/env node
/**
 * The comment-policy gate.
 *
 * Two rules, both about comments that record *history* rather than explain code:
 *
 *   1. A date in a source comment. `git log` and `git blame` already hold when a
 *      line changed and why; a date in the source is a changelog entry that no
 *      longer updates when the code around it does. (Skills and docs may carry
 *      dates — a decision's date can be load-bearing there. Source may not.)
 *   2. A comment block longer than MAX_BLOCK_LINES. Past that length a comment is
 *      narrating rather than clarifying; move it to the owning skill or cut it.
 *
 * Both are deliberately narrow. This checker exists because AGENTS.md rule 4
 * ("prefer a lint over prose whenever a lint can enforce the rule") applies to
 * the doc rules themselves, not just to code.
 *
 * Self-checked by decoys at the bottom, matching lint-audit.mjs and
 * lint-commit-message.mjs: `pnpm test` only collects `src/**`, so a `scripts/`
 * checker proves itself or nothing does.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Beyond this an inline comment is narrating, not clarifying. A file's FIRST
 * comment block is the module header — it states the module's contract and is
 * read once, so it gets a larger budget than a comment wedged inside a function.
 */
export const MAX_BLOCK_LINES = 8
export const MAX_HEADER_LINES = 20
/** ISO dates are the form this repo's comments actually used. */
const DATE = /\b20\d{2}-\d{2}-\d{2}\b/

const ROOTS = ['src', 'apps/mobile/src']
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.expo'])
/** Vendored shadcn primitives are upstream's text, not ours to police. */
const SKIP_PATHS = ['src/renderer/src/components/ui/']

/**
 * Comment spans in a source file, as [startLine, endLine] pairs (1-based).
 * Strips string and template literals first so a URL or a date inside a string
 * is never mistaken for a comment. PURE.
 */
export function commentSpans(source) {
  const spans = []
  let line = 1
  let i = 0
  let start = 0
  let state = 'code'
  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]
    if (ch === '\n') line++
    if (state === 'code') {
      if (ch === '/' && next === '/') {
        start = line
        state = 'line'
      } else if (ch === '/' && next === '*') {
        start = line
        state = 'block'
        i += 2
        continue
      } else if (ch === "'" || ch === '"' || ch === '`') {
        state = ch
      }
    } else if (state === 'line') {
      if (ch === '\n') {
        spans.push([start, line - 1])
        state = 'code'
      }
    } else if (state === 'block') {
      if (ch === '*' && next === '/') {
        spans.push([start, line])
        state = 'code'
        i += 2
        continue
      }
    } else if (ch === state && source[i - 1] !== '\\') {
      state = 'code'
    } else if (state !== '`' && ch === '\n') {
      state = 'code'
    }
    i++
  }
  // A run of consecutive `//` lines reads as one block — merge so the length
  // rule sees what a human sees, not N one-line spans.
  const merged = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (last && span[0] === last[1] + 1) last[1] = span[1]
    else merged.push([...span])
  }
  return merged
}

/** Violations in one file's source. PURE — the filesystem stays in `main`. */
export function findViolations(path, source) {
  const lines = source.split('\n')
  const out = []
  const spans = commentSpans(source)
  spans.forEach(([from, to], index) => {
    const text = lines.slice(from - 1, to).join('\n')
    const dated = DATE.exec(text)
    if (dated) {
      out.push(`${path}:${from}  dated comment (${dated[0]}) — git holds the history`)
    }
    // The first comment block in a file is its header, wherever it sits — most
    // land under the import block, not at line 1.
    const header = index === 0
    const max = header ? MAX_HEADER_LINES : MAX_BLOCK_LINES
    const span = to - from + 1
    if (span > max) {
      out.push(`${path}:${from}  ${span}-line ${header ? 'header' : 'inline'} comment (max ${max})`)
    }
  })
  return out
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      yield* walk(path)
    } else if (/\.tsx?$/.test(path) && !path.endsWith('.d.ts')) {
      yield path
    }
  }
}

function selfCheck() {
  const failures = []
  const dated = findViolations('decoy.ts', '// decided 2026-01-02 for a reason\nconst a = 1\n')
  if (dated.length !== 1) failures.push('a dated comment must be flagged')
  const inString = findViolations('decoy.ts', 'const a = "2026-01-02"\n')
  if (inString.length !== 0) failures.push('a date inside a string must NOT be flagged')
  // An inline block is anything after the module header, so every decoy needs a
  // header ahead of it — otherwise it is measured against the header budget.
  const body = (n) => `// header\nconst a = 1\n\n${'// x\n'.repeat(n)}const b = 2\n`
  const long = findViolations('decoy.ts', body(MAX_BLOCK_LINES + 1))
  if (long.length !== 1) failures.push('an over-long inline block must be flagged')
  const short = findViolations('decoy.ts', body(MAX_BLOCK_LINES))
  if (short.length !== 0) failures.push('an inline block at the limit must NOT be flagged')
  const header = findViolations('decoy.ts', `${'// x\n'.repeat(MAX_HEADER_LINES + 1)}const a = 1\n`)
  if (header.length !== 1) failures.push('an over-long header must be flagged')
  const okHeader = findViolations('decoy.ts', `${'// x\n'.repeat(MAX_HEADER_LINES)}const a = 1\n`)
  if (okHeader.length !== 0) failures.push('a header at the limit must NOT be flagged')
  const jsx = findViolations('decoy.tsx', '<div>\n{/* a\n b\n 2026-01-02\n*/}\n</div>\n')
  if (jsx.length !== 1) failures.push('a JSX block comment must be scanned')
  return failures
}

function main() {
  const selfFailures = selfCheck()
  if (selfFailures.length > 0) {
    console.error('lint-comments: SELF-CHECK FAILED')
    for (const failure of selfFailures) console.error(`  ${failure}`)
    process.exit(1)
  }

  const violations = []
  for (const root of ROOTS) {
    for (const path of walk(root)) {
      if (SKIP_PATHS.some((skip) => path.startsWith(skip))) continue
      violations.push(...findViolations(path, readFileSync(path, 'utf8')))
    }
  }
  if (violations.length > 0) {
    console.error('lint-comments: comments must explain code, not record history\n')
    for (const violation of violations) console.error(`  ${violation}`)
    console.error(`\n${violations.length} violation(s).`)
    process.exit(1)
  }
  console.log('lint-comments · ok')
}

main()
