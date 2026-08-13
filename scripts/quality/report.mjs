#!/usr/bin/env node
/**
 * Quantitative quality scorecard.
 *
 * The architecture gates already measure *structure* — dependency direction, module sizes,
 * escape hatches. Nothing measured whether the tests are worth anything. This reads that
 * second half: coverage per domain, cognitive complexity, dead code, module-size headroom.
 *
 * Deliberately measurement-only. It prints, it snapshots, it never fails a build. A threshold
 * picked before anyone has seen the distribution is either toothless or permanently in the way,
 * so the ratchet lands in a later unit against the baseline this writes.
 *
 *   node scripts/quality/report.mjs                  # measure (reuses a fresh coverage run)
 *   node scripts/quality/report.mjs --fresh          # force the coverage suite to re-run
 *   node scripts/quality/report.mjs --write-baseline # snapshot into scripts/quality/baseline.json
 *   node scripts/quality/report.mjs --json           # machine-readable, no scorecard
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ARCHITECTURE_LINE_CEILING,
  DOMAIN_KEYS,
  TARGET_DOMAIN_ROOTS,
} from '../architecture/domains.mjs'
import { GATED_KINDS, scanTestShape } from './test-shape.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASELINE = path.join(root, 'scripts', 'quality', 'baseline.json')
const COVERAGE_SUMMARY = path.join(root, 'apps', 'desktop', 'coverage', 'coverage-summary.json')

const args = new Set(process.argv.slice(2))
const asJson = args.has('--json')
const writeBaseline = args.has('--write-baseline')
const forceFresh = args.has('--fresh')

// Coverage older than this is stale enough to mislead a decision made from it.
const COVERAGE_MAX_AGE_MS = 60 * 60 * 1000

const AREAS = [
  'apps/daemon',
  'apps/cli',
  'apps/web',
  'apps/desktop',
  'apps/mobile',
  'packages/contracts',
  'packages/client-runtime',
  'packages/shared',
]

const SKIP_DIRS = new Set(['node_modules', 'out', 'dist', 'build', 'coverage', '.expo'])

function note(message) {
  if (!asJson) process.stderr.write(`${message}\n`)
}

function walk(directory, output = []) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return output
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(directory, entry.name), output)
    } else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) {
      output.push(path.join(directory, entry.name))
    }
  }
  return output
}

function isProductionSource(relativePath) {
  if (/\.test\.tsx?$/.test(relativePath)) return false
  if (/\.d\.ts$/.test(relativePath)) return false
  if (relativePath.includes('/testing/')) return false
  if (relativePath.includes('/__fixtures__/')) return false
  // Generated shadcn primitives are re-applied from upstream, not authored here.
  if (relativePath.includes('/components/ui/')) return false
  return true
}

/** Percentage that reads as a number, not a string, and never divides by zero. */
function pct(covered, total) {
  return total === 0 ? null : Math.round((covered / total) * 1000) / 10
}

// ---------------------------------------------------------------- coverage

function coverageIsFresh() {
  if (!existsSync(COVERAGE_SUMMARY)) return false
  return Date.now() - statSync(COVERAGE_SUMMARY).mtimeMs < COVERAGE_MAX_AGE_MS
}

function runCoverage() {
  note('Running the suite with coverage (this takes a couple of minutes)…')
  execFileSync('pnpm', ['--dir', 'apps/desktop', 'test:coverage'], {
    cwd: root,
    stdio: asJson ? 'ignore' : 'inherit',
  })
}

/**
 * Roll per-file coverage up along two axes. Areas answer "which package is thin"; domains
 * answer the question the architecture actually asks — a domain spans contracts, daemon,
 * client-runtime, web, and mobile, so its real number is the one summed across all five roots.
 */
function readCoverage() {
  if (!existsSync(COVERAGE_SUMMARY)) return null
  const summary = JSON.parse(readFileSync(COVERAGE_SUMMARY, 'utf8'))

  const blank = () => ({ statements: { covered: 0, total: 0 }, branches: { covered: 0, total: 0 } })
  const areas = Object.fromEntries(AREAS.map((area) => [area, blank()]))
  const domains = Object.fromEntries(DOMAIN_KEYS.map((domain) => [domain, blank()]))
  const uncovered = []

  for (const [absolute, entry] of Object.entries(summary)) {
    if (absolute === 'total') continue
    const relative = path.relative(root, absolute).split(path.sep).join('/')
    if (!isProductionSource(relative)) continue

    const add = (bucket) => {
      bucket.statements.covered += entry.statements.covered
      bucket.statements.total += entry.statements.total
      bucket.branches.covered += entry.branches.covered
      bucket.branches.total += entry.branches.total
    }

    const area = AREAS.find((candidate) => relative.startsWith(`${candidate}/`))
    if (area) add(areas[area])

    const domainRoot = TARGET_DOMAIN_ROOTS.find((candidate) => relative.startsWith(`${candidate}/`))
    if (domainRoot) {
      const domain = relative.slice(domainRoot.length + 1).split('/')[0]
      if (domains[domain]) add(domains[domain])
    }

    // A production file whose statements were never executed is the honest headline:
    // it is not "low coverage", it is untested.
    if (entry.statements.total > 0 && entry.statements.covered === 0) {
      uncovered.push({ file: relative, statements: entry.statements.total })
    }
  }

  const shape = (bucket) => ({
    statements: pct(bucket.statements.covered, bucket.statements.total),
    branches: pct(bucket.branches.covered, bucket.branches.total),
    statementCount: bucket.statements.total,
  })

  return {
    total: shape(
      Object.values(areas).reduce((accumulator, bucket) => {
        accumulator.statements.covered += bucket.statements.covered
        accumulator.statements.total += bucket.statements.total
        accumulator.branches.covered += bucket.branches.covered
        accumulator.branches.total += bucket.branches.total
        return accumulator
      }, blank()),
    ),
    areas: Object.fromEntries(Object.entries(areas).map(([key, value]) => [key, shape(value)])),
    domains: Object.fromEntries(Object.entries(domains).map(([key, value]) => [key, shape(value)])),
    untestedFiles: uncovered.sort((a, b) => b.statements - a.statements),
  }
}

// -------------------------------------------------------------- complexity

/**
 * Biome owns the cognitive-complexity score; `--only` runs the rule regardless of it being off
 * in biome.json, so measuring here costs nothing in the commit-time gate.
 */
function readComplexity() {
  let raw
  try {
    raw = execFileSync(
      'pnpm',
      [
        'exec',
        'biome',
        'lint',
        '--only=complexity/noExcessiveCognitiveComplexity',
        '--reporter=json',
        '--max-diagnostics=5000',
        // Product source only. The lint scripts under scripts/ are branch-heavy AST walkers
        // by nature; counting them buries the shipped code they exist to protect.
        ...AREAS.map((area) => `${area}/src`),
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    )
  } catch (error) {
    // The rule reports at `info`, so a non-zero exit means a real failure — but stdout still
    // holds the payload when the only problem was diagnostic volume.
    raw = error.stdout ?? ''
    if (!raw.trim()) {
      note('Complexity scan failed; reporting it as unmeasured rather than as zero offenders.')
      return null
    }
  }

  const payload = JSON.parse(raw.slice(raw.indexOf('{')))
  const offenders = payload.diagnostics
    .map((diagnostic) => ({
      file: diagnostic.location?.path?.file ?? diagnostic.location?.path ?? 'unknown',
      line: diagnostic.location?.span?.[0] ?? diagnostic.location?.start?.line ?? 0,
      score: Number(/complexity of (\d+)/.exec(diagnostic.message ?? '')?.[1] ?? 0),
    }))
    .filter((offender) => offender.score > 0)
    .sort((a, b) => b.score - a.score)

  return {
    ceiling: 15,
    overCeiling: offenders.length,
    worst: offenders.slice(0, 10),
  }
}

// ---------------------------------------------------------------- dead code

function readDeadCode() {
  let raw
  try {
    raw = execFileSync('pnpm', ['exec', 'knip', '--reporter', 'json', '--no-progress'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
  } catch (error) {
    // knip exits non-zero whenever it finds anything, which is the normal case here.
    raw = error.stdout ?? ''
    if (!raw.trim()) {
      note('knip scan failed; reporting it as unmeasured rather than as zero findings.')
      return null
    }
  }

  const payload = JSON.parse(raw.slice(raw.indexOf('{')))
  const issues = Array.isArray(payload) ? payload : (payload.issues ?? payload.files ?? [])
  const counts = {}
  for (const issue of issues) {
    for (const [category, value] of Object.entries(issue)) {
      if (!Array.isArray(value) || value.length === 0) continue
      counts[category] = (counts[category] ?? 0) + value.length
    }
  }
  return { total: Object.values(counts).reduce((sum, n) => sum + n, 0), byCategory: counts }
}

// -------------------------------------------------------- size and test shape

function readModuleSizes() {
  const files = []
  for (const area of AREAS) {
    for (const absolute of walk(path.join(root, area))) {
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      if (!isProductionSource(relative)) continue
      const source = readFileSync(absolute, 'utf8')
      files.push({
        file: relative,
        lines: source.split('\n').length - (source.endsWith('\n') ? 1 : 0),
      })
    }
  }
  files.sort((a, b) => b.lines - a.lines)
  const over = files.filter((entry) => entry.lines > ARCHITECTURE_LINE_CEILING)
  return {
    ceiling: ARCHITECTURE_LINE_CEILING,
    productionFiles: files.length,
    overCeiling: over.length,
    worst: files.slice(0, 10),
  }
}

/**
 * Not a quality metric on its own — a file count says nothing about assertions. It is here as
 * the denominator that makes a coverage number readable, and to surface areas with no tests.
 */
function readTestShape() {
  const shape = {}
  for (const area of AREAS) {
    let sources = 0
    let tests = 0
    for (const absolute of walk(path.join(root, area))) {
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      if (/\.test\.tsx?$/.test(relative)) tests += 1
      else if (isProductionSource(relative)) sources += 1
    }
    shape[area] = { sources, tests }
  }
  return shape
}

// ------------------------------------------------------------------ output

function bar(value) {
  if (value === null) return '—'
  const filled = Math.round(value / 10)
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${value.toFixed(1).padStart(5)}%`
}

function printScorecard(report) {
  const lines = []
  lines.push('')
  lines.push('  PORCELAIN QUALITY BASELINE')
  lines.push(`  ${'─'.repeat(60)}`)

  if (report.coverage) {
    lines.push('')
    lines.push(`  Coverage — statements ${bar(report.coverage.total.statements)}`)
    lines.push(`             branches   ${bar(report.coverage.total.branches)}`)
    lines.push('')
    lines.push('  By domain (contracts + daemon + client-runtime + web + mobile)')
    for (const [domain, value] of Object.entries(report.coverage.domains)) {
      if (value.statementCount === 0) continue
      lines.push(`    ${domain.padEnd(14)} ${bar(value.statements)}   br ${bar(value.branches)}`)
    }
    lines.push('')
    lines.push('  By package')
    for (const [area, value] of Object.entries(report.coverage.areas)) {
      if (value.statementCount === 0) continue
      lines.push(`    ${area.padEnd(24)} ${bar(value.statements)}`)
    }
    lines.push('')
    lines.push(`  Untested production files: ${report.coverage.untestedFiles.length}`)
    for (const entry of report.coverage.untestedFiles.slice(0, 5)) {
      lines.push(`    ${entry.statements.toString().padStart(5)} stmts  ${entry.file}`)
    }
  } else {
    lines.push('')
    lines.push('  Coverage — not measured (no report found)')
  }

  lines.push('')
  lines.push(`  ${'─'.repeat(60)}`)
  if (report.complexity) {
    lines.push(
      `  Cognitive complexity  ${report.complexity.overCeiling} functions over ${report.complexity.ceiling}`,
    )
    for (const entry of report.complexity.worst.slice(0, 5)) {
      lines.push(`    ${entry.score.toString().padStart(4)}  ${entry.file}:${entry.line}`)
    }
  } else {
    lines.push('  Cognitive complexity  not measured')
  }

  lines.push('')
  lines.push(
    `  Module size           ${report.moduleSizes.overCeiling} of ${report.moduleSizes.productionFiles} files over ${report.moduleSizes.ceiling} lines`,
  )
  for (const entry of report.moduleSizes.worst.slice(0, 5)) {
    lines.push(`    ${entry.lines.toString().padStart(4)}  ${entry.file}`)
  }

  lines.push('')
  if (report.deadCode) {
    lines.push(`  Dead code (knip)      ${report.deadCode.total} findings`)
    const byCount = Object.entries(report.deadCode.byCategory).sort((a, b) => b[1] - a[1])
    for (const [category, count] of byCount.slice(0, 6)) {
      lines.push(`    ${count.toString().padStart(4)}  ${category}`)
    }
  } else {
    lines.push('  Dead code (knip)      not measured')
  }

  lines.push('')
  const quality = report.testQuality
  lines.push(`  Test shape            ${quality.tests} tests across ${quality.files} files`)
  for (const kind of ['focused', 'disabled', 'tautology', 'no-assert', 'weak-only', 'mock-only']) {
    const count = quality.counts[kind] ?? 0
    const gated = quality.gatedKinds.includes(kind) ? ' (gated)' : ''
    lines.push(`    ${count.toString().padStart(4)}  ${kind}${gated}`)
  }

  lines.push('')
  lines.push(`  ${'─'.repeat(60)}`)
  lines.push('  Coverage, complexity, size, and dead code are measurement only.')
  lines.push('  Test shape gates four always-wrong kinds; the rest is judgment.')
  lines.push('')
  process.stdout.write(lines.join('\n'))
}

// -------------------------------------------------------------------- main

if (forceFresh || !coverageIsFresh()) runCoverage()
else note('Reusing the existing coverage report (pass --fresh to re-run the suite).')

const shape = scanTestShape(root)
const shapeCounts = {}
for (const finding of shape.findings) {
  shapeCounts[finding.kind] = (shapeCounts[finding.kind] ?? 0) + 1
}

const report = {
  coverage: readCoverage(),
  complexity: readComplexity(),
  deadCode: readDeadCode(),
  moduleSizes: readModuleSizes(),
  testShape: readTestShape(),
  testQuality: {
    tests: shape.testCount,
    files: shape.fileCount,
    gatedKinds: GATED_KINDS,
    counts: shapeCounts,
  },
}

if (asJson) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
else printScorecard(report)

if (writeBaseline) {
  writeFileSync(BASELINE, `${JSON.stringify(report, null, 2)}\n`)
  note(`\nBaseline written to ${path.relative(root, BASELINE)}`)
}
