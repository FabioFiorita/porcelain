#!/usr/bin/env node
/**
 * Dead-code gate: knip counts may shrink, never grow.
 *
 * knip sat in devDependencies with no caller for months. Wiring it as a hard zero is not honest
 * — 300-odd unused exports are real but clearing them is its own project, and a gate that is red
 * on arrival teaches people to skip it. So this is the shrink-only shape the architecture gate
 * already uses: a committed count per category, growth fails, shrinkage prints and asks to be
 * re-recorded.
 *
 * Counts, not identities, because knip reports an export by name and a rename would read as one
 * deletion plus one addition. The number going down is the signal.
 *
 *   node scripts/quality/dead-code.mjs                  # gate
 *   node scripts/quality/dead-code.mjs --write-baseline # re-record after cleaning
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASELINE = path.join(root, 'scripts', 'quality', 'dead-code-baseline.json')
const writeBaseline = process.argv.includes('--write-baseline')

/** Category → count, from knip's JSON reporter. */
export function countIssues(payload) {
  const entries = Array.isArray(payload) ? payload : (payload.issues ?? payload.files ?? [])
  const counts = {}
  for (const entry of entries) {
    for (const [category, value] of Object.entries(entry)) {
      if (!Array.isArray(value) || value.length === 0) continue
      counts[category] = (counts[category] ?? 0) + value.length
    }
  }
  return counts
}

function measure() {
  let raw
  try {
    raw = execFileSync('pnpm', ['exec', 'knip', '--reporter', 'json', '--no-progress'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
  } catch (error) {
    // knip exits non-zero whenever it finds anything, which is the normal path here.
    raw = error.stdout ?? ''
    if (!raw.trim()) {
      process.stderr.write('dead-code: knip produced no output — treating as a broken run.\n')
      process.exit(1)
    }
  }
  return countIssues(JSON.parse(raw.slice(raw.indexOf('{'))))
}

const counts = measure()
const total = Object.values(counts).reduce((sum, n) => sum + n, 0)

if (writeBaseline) {
  const ordered = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(BASELINE, `${JSON.stringify(ordered, null, 2)}\n`)
  process.stdout.write(`dead-code: baseline written — ${total} finding(s)\n`)
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
const grew = []
const shrank = []

for (const [category, count] of Object.entries(counts)) {
  const allowed = baseline[category] ?? 0
  if (count > allowed) grew.push(`${category}: ${count}, baseline allows ${allowed}`)
  else if (count < allowed) shrank.push(`${category}: ${allowed} → ${count}`)
}
for (const [category, allowed] of Object.entries(baseline)) {
  if (counts[category] === undefined && allowed > 0) shrank.push(`${category}: ${allowed} → 0`)
}

if (grew.length > 0) {
  for (const problem of grew) process.stderr.write(`${problem}\n`)
  process.stderr.write(
    '\ndead-code: knip findings grew. Delete the export, or wire it up — a baseline row is ' +
      'for debt that already exists, never for debt you just added.\n',
  )
  process.exit(1)
}

for (const entry of shrank) process.stdout.write(`  improved  ${entry}\n`)
if (shrank.length > 0) {
  process.stdout.write('dead-code: re-record with `pnpm lint:dead-code:baseline`\n')
}
process.stdout.write(`dead-code: ok — ${total} known finding(s), none new\n`)
