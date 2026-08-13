#!/usr/bin/env node
/**
 * The per-change verdict an agent runs before it claims a unit is done.
 *
 * `pnpm quality` reads the whole repo, which is the wrong question mid-change: a repo-wide
 * percentage barely moves when one file lands untested, so it can never say "you left this
 * worse." This reads only what the working tree changed and answers that.
 *
 * What it refuses to do is score. There is no number to raise here, because a number is the one
 * thing an agent will optimize directly — writing tests that execute lines without asserting
 * anything. It names specific files and what is missing about them.
 *
 *   pnpm quality:changed              # vs the merge base with main
 *   pnpm quality:changed --base HEAD~3
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeTestFile, GATED_KINDS } from './test-shape.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const COVERAGE_SUMMARY = path.join(root, 'apps', 'desktop', 'coverage', 'coverage-summary.json')

const argv = process.argv.slice(2)
const baseFlag = argv.indexOf('--base')
const explicitBase = baseFlag === -1 ? null : argv[baseFlag + 1]

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function baseRef() {
  if (explicitBase !== null && explicitBase !== undefined) return explicitBase
  try {
    return git(['merge-base', 'HEAD', 'main'])
  } catch {
    return 'HEAD~1'
  }
}

const base = baseRef()

/** Changed files that still exist, as repo-relative paths. */
function changedFiles() {
  const tracked = git(['diff', '--name-only', base, '--']).split('\n')
  const staged = git(['diff', '--name-only', '--cached']).split('\n')
  const working = git(['diff', '--name-only']).split('\n')
  const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n')
  const all = new Set([...tracked, ...staged, ...working, ...untracked].filter(Boolean))
  return [...all].filter((file) => existsSync(path.join(root, file)))
}

const SOURCE = /^(apps|packages)\/[^/]+\/src\/.+\.tsx?$/
// SOURCE anchors at the repo root on purpose: a Stryker sandbox under .stryker-tmp/ mirrors the
// whole tree, and matching on the filename alone pulled every copied test into the report.
const isTest = (file) => SOURCE.test(file) && /\.test\.tsx?$/.test(file)
const isProduction = (file) =>
  SOURCE.test(file) &&
  !isTest(file) &&
  !/\.d\.ts$/.test(file) &&
  !file.includes('/testing/') &&
  !file.includes('/components/ui/')

const changed = changedFiles()
const production = changed.filter(isProduction)
const tests = changed.filter(isTest)

// ------------------------------------------------------------------ coverage

function coverageByFile() {
  if (!existsSync(COVERAGE_SUMMARY)) return null
  const ageMs = Date.now() - statSync(COVERAGE_SUMMARY).mtimeMs
  const summary = JSON.parse(readFileSync(COVERAGE_SUMMARY, 'utf8'))
  const byFile = {}
  for (const [absolute, entry] of Object.entries(summary)) {
    if (absolute === 'total') continue
    byFile[path.relative(root, absolute).split(path.sep).join('/')] = entry
  }
  return { byFile, ageMs }
}

const coverage = coverageByFile()
const findings = []

for (const file of production) {
  const entry = coverage?.byFile[file]
  if (entry === undefined) {
    findings.push({ file, note: 'no coverage record — run `pnpm test:coverage`' })
    continue
  }
  if (entry.statements.total === 0) continue
  if (entry.statements.covered === 0) {
    findings.push({ file, note: `untested — ${entry.statements.total} statements, 0% covered` })
  } else if (entry.statements.pct < 50) {
    findings.push({ file, note: `${entry.statements.pct}% of statements covered` })
  }
}

// ---------------------------------------------------------------- test shape

const shapeFindings = []
for (const file of tests) {
  const result = analyzeTestFile(file, readFileSync(path.join(root, file), 'utf8'))
  shapeFindings.push(...result.findings)
}

// ------------------------------------------------------------------- report

const out = ['', `  CHANGED SINCE ${base.slice(0, 12)}`, `  ${'─'.repeat(58)}`]
out.push(`  ${production.length} production file(s), ${tests.length} test file(s)`)

if (production.length === 0 && tests.length === 0) {
  out.push('')
  out.push('  No product source touched — nothing to prove here.')
  out.push('')
  process.stdout.write(out.join('\n'))
  process.exit(0)
}

if (coverage === null) {
  out.push('')
  out.push('  Coverage not measured. Run `pnpm test:coverage` for a per-file read.')
} else if (coverage.ageMs > 60 * 60 * 1000) {
  const hours = Math.round(coverage.ageMs / 3_600_000)
  out.push('')
  out.push(`  ! Coverage report is ~${hours}h old; re-run \`pnpm test:coverage\` to trust it.`)
}

out.push('')
if (findings.length === 0) {
  out.push('  Coverage    every changed production file is exercised')
} else {
  out.push('  Coverage    files a reviewer should ask about')
  for (const finding of findings) {
    out.push(`    ${finding.file}`)
    out.push(`      ${finding.note}`)
  }
}

out.push('')
const gated = shapeFindings.filter((finding) => GATED_KINDS.includes(finding.kind))
const soft = shapeFindings.filter((finding) => !GATED_KINDS.includes(finding.kind))
if (shapeFindings.length === 0) {
  out.push('  Test shape  no hollow tests in the files you touched')
} else {
  out.push('  Test shape')
  for (const finding of [...gated, ...soft]) {
    out.push(`    ${finding.file}:${finding.line} [${finding.kind}]`)
    out.push(`      "${finding.title}" — ${finding.detail}`)
  }
}

out.push('')
out.push(`  ${'─'.repeat(58)}`)
out.push('  Not a score. Coverage is a floor here, never a target — a test written to')
out.push('  raise a percentage without asserting behavior is the defect, not the fix.')
out.push('')
process.stdout.write(out.join('\n'))

// Gated shapes are defects wherever they appear, including mid-change.
process.exit(gated.length > 0 ? 1 : 0)
