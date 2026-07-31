#!/usr/bin/env node
/**
 * The comment-policy gate: comments/docs that record *history* or *account
 * status* instead of a durable technical constraint.
 *
 *   1. A date in a comment (JS-family, YAML/shell) or markdown prose — `git
 *      log`/`blame` already hold when and why. Markdown fences and inline
 *      code are exempt: a date in a command example is data, not narrative.
 *   2. A comment block over MAX_BLOCK_LINES (code only, not markdown prose).
 *   3. A billing/plan-status narrative (see `BILLING_NARRATIVE`) spanning 3+
 *      lines of a comment or markdown paragraph. A one-line mention is a
 *      technical constraint and stays; the essay belongs in the commit
 *      message, not in docs that go stale the moment the plan changes.
 *
 * All deliberately narrow, per AGENTS.md rule 4 ("prefer a lint over prose").
 * Self-checked by decoys at the bottom, matching lint-audit.mjs: `pnpm test`
 * only collects `src/**`, so a `scripts/` checker proves itself or nothing does.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Beyond this an inline comment is narrating, not clarifying. A file's FIRST
 * comment block is the module header — it states the module's contract and is
 * read once, so it gets a larger budget than a comment wedged inside a function.
 * Markdown files don't use either budget; they have no size cap (rule 2).
 */
export const MAX_BLOCK_LINES = 8
export const MAX_HEADER_LINES = 20
/** Below this a billing/plan-status line is a constraint, not a narrative (rule 3). */
const MIN_NARRATIVE_LINES = 3
/** ISO dates are the form this repo's comments actually used. */
const DATE = /\b20\d{2}-\d{2}-\d{2}\b/
/** Case-insensitive: these record an account's subscription state, not a technical fact. */
const BILLING_NARRATIVE =
  /paid plan|free plan|current plan|production plan|account is closed|we don['’]t pay|we do not pay/i

const ROOTS = ['.']
/** Generated, vendored, or adapter output — never the source of truth for prose or comments. */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.expo',
  'out',
  'dist-daemon',
  '.git',
  '.claude',
  '.codex',
])
/**
 * Vendored shadcn primitives are upstream's text, not ours to police. `.husky/_`
 * is husky's regenerated shim directory (its own `.gitignore` covers it — see
 * AGENTS.md). `apps/mobile/ios` is CNG-generated native output when it exists.
 */
const SKIP_PATHS = [
  'src/renderer/src/components/ui/',
  '.husky/_/',
  'apps/mobile/ios/',
  'CHANGELOG.md',
]

/**
 * Comment spans in a JS-family file, as [startLine, endLine] pairs (1-based).
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
  return mergeAdjacent(spans)
}

/** A run of consecutive comment lines reads as one block — merge so the length rule sees what a human sees. */
function mergeAdjacent(spans) {
  const merged = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (last && span[0] === last[1] + 1) last[1] = span[1]
    else merged.push([...span])
  }
  return merged
}

/** Is `#` on this line a comment marker, i.e. not inside a quoted string? */
function hasHashComment(line) {
  let state = 'code'
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (state === 'code') {
      if (ch === '#') return true
      if (ch === "'" || ch === '"') state = ch
    } else if (ch === state && line[i - 1] !== '\\') {
      state = 'code'
    }
  }
  return false
}

/** Comment spans in a YAML or shell file — one span per `#`-bearing line, merged like `commentSpans`. PURE. */
export function hashCommentSpans(source) {
  const spans = []
  source.split('\n').forEach((line, index) => {
    if (hasHashComment(line)) spans.push([index + 1, index + 1])
  })
  return mergeAdjacent(spans)
}

/**
 * Paragraph spans in a markdown file: runs of consecutive non-blank lines
 * outside fenced code blocks. Headings and list items merge into the paragraph
 * around them same as any other prose line — deliberately coarse, matching the
 * `//` merge pass rather than a real markdown parser. PURE.
 */
export function proseSpans(source) {
  const spans = []
  let inFence = false
  let current = null
  const close = () => {
    if (current) spans.push(current)
    current = null
  }
  source.split('\n').forEach((rawLine, index) => {
    const lineNo = index + 1
    const trimmed = rawLine.trim()
    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence
      close()
      return
    }
    if (inFence || trimmed === '') {
      close()
      return
    }
    if (current) current[1] = lineNo
    else current = [lineNo, lineNo]
  })
  close()
  return spans
}

/** Drop inline code spans so a date or phrase quoted as code isn't mistaken for prose. */
const stripInlineCode = (line) => line.replace(/`[^`]*`/g, '')

/** Rule 3 across a span: only a 3+ line span counts as a narrative, not a one-line constraint. */
function billingViolations(path, lines, from, to, strip = (line) => line) {
  const out = []
  if (to - from + 1 < MIN_NARRATIVE_LINES) return out
  for (let n = from; n <= to; n++) {
    const match = BILLING_NARRATIVE.exec(strip(lines[n - 1]))
    if (match) {
      out.push(
        `${path}:${n}  billing/plan-status narrative ("${match[0]}") — state the technical constraint in one line; put the rationale in the commit message`,
      )
    }
  }
  return out
}

/**
 * Strip a line down to what's left after its comment marker (line-comment,
 * block open/close, continuation `*`, or `#`). A line that is nothing but the
 * marker is a paragraph separator — a blank line inside a comment block, same
 * role as a blank line in markdown.
 */
function isMarkerOnlyLine(line) {
  const content = line
    .trim()
    .replace(/^[*/#]+/, '')
    .replace(/\*\/\s*$/, '')
    .trim()
  return content === ''
}

/**
 * Split a comment span into paragraphs on marker-only separator lines. Size
 * caps measure the whole span (total context cost); the narrative rule needs
 * this finer grain so a paid-plan clause isolated in its own short paragraph,
 * inside an otherwise long header, doesn't inherit the header's length.
 */
function commentParagraphs(lines, from, to) {
  const paragraphs = []
  let start = null
  for (let n = from; n <= to; n++) {
    if (isMarkerOnlyLine(lines[n - 1])) {
      if (start !== null) {
        paragraphs.push([start, n - 1])
        start = null
      }
    } else if (start === null) {
      start = n
    }
  }
  if (start !== null) paragraphs.push([start, to])
  return paragraphs
}

/** Violations across a file's comment spans (JS-family, YAML, shell): date ban + size cap + billing ban. */
function checkCommentSpans(path, lines, spans) {
  const out = []
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
    for (const [pFrom, pTo] of commentParagraphs(lines, from, to)) {
      out.push(...billingViolations(path, lines, pFrom, pTo))
    }
  })
  return out
}

/** Violations across a markdown file's paragraphs: date ban + billing ban, no size cap. */
function checkProseSpans(path, lines, spans) {
  const out = []
  for (const [from, to] of spans) {
    const stripped = lines
      .slice(from - 1, to)
      .map(stripInlineCode)
      .join('\n')
    const dated = DATE.exec(stripped)
    if (dated) {
      out.push(`${path}:${from}  dated text (${dated[0]}) — git holds the history`)
    }
    out.push(...billingViolations(path, lines, from, to, stripInlineCode))
  }
  return out
}

/** Violations in one file's source. PURE — the filesystem stays in `main`. Dispatches on `path`'s extension. */
export function findViolations(path, source) {
  const lines = source.split('\n')
  if (/\.md$/.test(path)) return checkProseSpans(path, lines, proseSpans(source))
  if (/\.(ya?ml|sh)$/.test(path)) return checkCommentSpans(path, lines, hashCommentSpans(source))
  return checkCommentSpans(path, lines, commentSpans(source))
}

const COVERED = /\.(tsx?|mjs|js|ya?ml|sh|md)$/

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      yield* walk(path)
    } else if (COVERED.test(path) && !path.endsWith('.d.ts')) {
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

  const dotJs = findViolations('decoy.js', '// decided 2026-01-02 for a reason\nconst a = 1\n')
  if (dotJs.length !== 1) failures.push('a dated comment in a .js file must be flagged')
  const dotMjs = findViolations('decoy.mjs', body(MAX_BLOCK_LINES + 1))
  if (dotMjs.length !== 1) failures.push('an over-long inline block in a .mjs file must be flagged')

  const datedYaml = findViolations(
    'decoy.yml',
    'name: ci\n# shipped 2026-01-02, revisit later\non: push\n',
  )
  if (datedYaml.length !== 1) failures.push('a dated YAML comment must be flagged')
  const yamlBody = (n) => `# header\nname: ci\n\n${'# x\n'.repeat(n)}on: push\n`
  const longYaml = findViolations('decoy.yml', yamlBody(MAX_BLOCK_LINES + 1))
  if (longYaml.length !== 1) failures.push('an over-long YAML comment block must be flagged')
  const shortYaml = findViolations('decoy.yml', yamlBody(MAX_BLOCK_LINES))
  if (shortYaml.length !== 0) failures.push('a YAML comment block at the limit must NOT be flagged')
  const hashInString = findViolations('decoy.yml', "name: 'a # b'\n")
  if (hashInString.length !== 0)
    failures.push('a `#` inside a quoted YAML string must NOT be flagged')

  const datedSh = findViolations('decoy.sh', '#!/bin/sh\n# ran this on 2026-01-02\necho hi\n')
  if (datedSh.length !== 1) failures.push('a dated shell comment must be flagged')

  const datedMd = findViolations(
    'decoy.md',
    'Some prose that mentions a date inline, decided on 2026-01-02 and never revisited.\n',
  )
  if (datedMd.length !== 1) failures.push('a dated markdown paragraph must be flagged')
  const fencedDateMd = findViolations('decoy.md', '```\n# ran on 2026-01-02\n```\n')
  if (fencedDateMd.length !== 0)
    failures.push('a date inside a markdown fenced code block must NOT be flagged')
  const inlineCodeDateMd = findViolations(
    'decoy.md',
    'Run it with `--start 2026-01-02 --end 2026-01-03`.\n',
  )
  if (inlineCodeDateMd.length !== 0)
    failures.push('a date inside a markdown inline code span must NOT be flagged')
  const longMd = findViolations(
    'decoy.md',
    `${'this paragraph line is fine and unremarkable.\n'.repeat(50)}`,
  )
  if (longMd.length !== 0) failures.push('markdown prose has no size cap')

  const narrative3 = findViolations(
    'decoy.ts',
    '// header\nconst a = 1\n\n// This costs us the paid plan features entirely.\n// We lose group targeting and release notes.\n// The free way back needs a second workflow.\nconst b = 2\n',
  )
  if (narrative3.filter((v) => v.includes('billing/plan-status')).length !== 1) {
    failures.push('a 3-line billing/plan-status narrative must be flagged')
  }
  const constraint1 = findViolations(
    'decoy.ts',
    '// header\nconst a = 1\n\n// a `testflight` job with a `build_id` requires a paid plan\nconst b = 2\n',
  )
  if (constraint1.filter((v) => v.includes('billing/plan-status')).length !== 0) {
    failures.push('a 1-line billing/plan-status constraint must NOT be flagged')
  }
  // A long comment block (well past MIN_NARRATIVE_LINES in total) whose billing
  // clause sits in its own paragraph, set off by marker-only `#` lines — the
  // paragraph, not the whole block, is what must be measured against the rule.
  const isolatedClause = findViolations(
    'decoy.yml',
    [
      'name: ci',
      '#',
      '# Some long context line one about behavior.',
      '# Some long context line two about behavior.',
      '# Some long context line three about behavior.',
      '#',
      '# a `testflight` job with a `build_id` requires a paid plan',
      '#',
      '# Some trailing context line one.',
      '# Some trailing context line two.',
      'on: push',
      '',
    ].join('\n'),
  )
  if (isolatedClause.filter((v) => v.includes('billing/plan-status')).length !== 0) {
    failures.push(
      'a billing clause isolated in its own 1-line paragraph inside a long block must NOT be flagged',
    )
  }
  const isolatedNarrative = findViolations(
    'decoy.yml',
    [
      'name: ci',
      '#',
      '# Some long context line one about behavior.',
      '# Some long context line two about behavior.',
      '# Some long context line three about behavior.',
      '#',
      '# This costs us the paid plan features entirely.',
      '# We lose group targeting and release notes.',
      '# The free way back needs a second workflow.',
      '#',
      '# Some trailing context line one.',
      '# Some trailing context line two.',
      'on: push',
      '',
    ].join('\n'),
  )
  if (isolatedNarrative.filter((v) => v.includes('billing/plan-status')).length !== 1) {
    failures.push('a 3-line billing paragraph inside a long block must still be flagged')
  }
  const narrativeMd = findViolations(
    'decoy.md',
    'This costs us the paid plan features entirely and we lose group\ntargeting and release notes as a result of it.\nThe free way back needs a second workflow triggered later.\n',
  )
  if (narrativeMd.filter((v) => v.includes('billing/plan-status')).length !== 1) {
    failures.push('a 3-line markdown billing/plan-status paragraph must be flagged')
  }

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
