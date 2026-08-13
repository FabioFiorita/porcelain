#!/usr/bin/env node
/**
 * Typecheck the test files, against a shrink-only ledger.
 *
 * Test files were outside every TypeScript project until this landed: `tsconfig.node.json` and
 * `tsconfig.web.json` both excluded `**\/*.test.ts`, and only the mobile project included any
 * tests. A `const x: number = 'nope'` in a web test passed `pnpm typecheck`, and an `expectTypeOf`
 * assertion asserting something false passed vitest AND tsc — inert in both gates it appeared to
 * satisfy.
 *
 * Turning the project on surfaces a backlog that cannot be cleared in one sitting, and a gate that
 * is red on arrival teaches people to skip it. So this follows the ledger idiom the architecture
 * gate already uses (`OVERSIZED_PRODUCTION_FILES`): every file's error count is recorded, counts
 * may shrink or hold, and growth fails. A file missing from the ledger must be clean.
 *
 * Most of the backlog is one of two shapes, and both are the masking problem in type form:
 *   - Fixtures are `as const`, so a test building a variant reads as a type error rather than a
 *     case. Widen to the contract type; do not clone the fixture.
 *   - `vi.fn(() => ({ ok: true, value: x }))` infers `{ ok: boolean }` and stands in for a
 *     discriminated union. A test asserting against that mock is asserting against a fiction.
 *
 *   node scripts/quality/typecheck-tests.mjs                  # gate
 *   node scripts/quality/typecheck-tests.mjs --write-ledger   # re-record after fixing
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DESKTOP = path.join(root, 'apps', 'desktop')
const LEDGER = path.join(root, 'scripts', 'quality', 'test-types-ledger.json')

const writeLedger = process.argv.includes('--write-ledger')

/** Run tsc over the tests project and count errors per repo-relative file. */
function measure() {
  let output = ''
  try {
    execFileSync('pnpm', ['exec', 'tsc', '--noEmit', '-p', 'tsconfig.tests.json'], {
      cwd: DESKTOP,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    // tsc exits non-zero whenever it reports anything, which is the expected path here.
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`
  }

  const counts = {}
  for (const line of output.split('\n')) {
    const match = /^(\S+?)\((\d+),(\d+)\): error TS\d+:/.exec(line)
    if (match === null) continue
    const absolute = path.resolve(DESKTOP, match[1])
    const relative = path.relative(root, absolute).split(path.sep).join('/')
    counts[relative] = (counts[relative] ?? 0) + 1
  }
  return counts
}

const counts = measure()
const total = Object.values(counts).reduce((sum, n) => sum + n, 0)

if (writeLedger) {
  const ordered = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(LEDGER, `${JSON.stringify(ordered, null, 2)}\n`)
  process.stdout.write(
    `typecheck-tests: ledger written — ${total} error(s) across ${Object.keys(counts).length} file(s)\n`,
  )
  process.exit(0)
}

const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'))
const problems = []
const improved = []

for (const [file, count] of Object.entries(counts)) {
  const allowed = ledger[file] ?? 0
  if (count > allowed) {
    problems.push(
      allowed === 0
        ? `${file}: ${count} new type error(s) — this file was clean`
        : `${file}: ${count} type errors, ledger allows ${allowed}`,
    )
  } else if (count < allowed) {
    improved.push(`${file}: ${allowed} → ${count}`)
  }
}
for (const [file, allowed] of Object.entries(ledger)) {
  if (counts[file] === undefined) improved.push(`${file}: ${allowed} → 0 (remove the row)`)
}

if (problems.length > 0) {
  for (const problem of problems) process.stderr.write(`${problem}\n`)
  process.stderr.write(
    '\ntypecheck-tests: test files must typecheck. Widen the fixture to its contract type, or ' +
      'type the mock to the port it stands in for — do not add a ledger row.\n',
  )
  process.exit(1)
}

if (improved.length > 0) {
  for (const entry of improved) process.stdout.write(`  improved  ${entry}\n`)
  process.stdout.write(
    'typecheck-tests: re-record with `node scripts/quality/typecheck-tests.mjs --write-ledger`\n',
  )
}
process.stdout.write(
  `typecheck-tests: ok — ${total} known error(s) across ${Object.keys(counts).length} file(s), none new\n`,
)
