#!/usr/bin/env node
/**
 * A context budget for the docs an agent loads.
 *
 * Three tiers, tightest first, because they cost different amounts:
 *   - AGENTS.md      — every session pays it, always.
 *   - SKILL.md       — paid whenever that skill is loaded, so it must ROUTE, not
 *                      hold the detail.
 *   - reference/*.md — paid only when an agent opens the file it needs.
 *
 * There is also a corpus total. A per-file cap alone is gamed by splitting one
 * long file into three short ones; the total is what forces the trade — to add,
 * you cut. `expo-*` / `eas-*` skills are vendored through `npx skills add` and
 * are budgeted separately: we do not author them and cannot edit them in place.
 *
 * Caps live in `scripts/ratchets.json` under `docBudget` and may only tighten.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const { docBudget } = JSON.parse(readFileSync(join(root, 'scripts', 'ratchets.json'), 'utf8'))

const SKILLS_DIR = join(root, '.agents', 'skills')
/** Pulled in by `npx skills add`; not ours to trim. */
const isVendored = (name) => /^(expo|eas)-/.test(name)

const words = (path) => readFileSync(path, 'utf8').trim().split(/\s+/).filter(Boolean).length

/** Every `.md` under a skill, at any depth — `reference/`, `rules/`, loose siblings alike. */
function markdownUnder(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) markdownUnder(path, out)
    else if (entry.name.endsWith('.md')) out.push(path)
  }
  return out
}

function collect() {
  const files = [{ rel: 'AGENTS.md', tier: 'agentsMd', words: words(join(root, 'AGENTS.md')) }]
  for (const name of readdirSync(SKILLS_DIR)) {
    if (isVendored(name)) continue
    for (const path of markdownUnder(join(SKILLS_DIR, name))) {
      const tier = path.endsWith(`${name}/SKILL.md`) ? 'skillMd' : 'reference'
      files.push({ rel: relative(root, path), tier, words: words(path) })
    }
  }
  return files
}

const files = collect()

// Without this the gate passes vacuously: if the corpus ever moves out from under
// the walk, the total drops to zero and everything looks fine. Every authored skill
// must contribute exactly one SKILL.md.
const authoredSkills = readdirSync(SKILLS_DIR).filter((name) => !isVendored(name))
const routers = files.filter((f) => f.tier === 'skillMd').length
if (routers !== authoredSkills.length) {
  console.error(
    `doc budget saw ${routers} SKILL.md for ${authoredSkills.length} authored skills — the walk is not finding the corpus`,
  )
  process.exit(2)
}

const total = files.reduce((sum, f) => sum + f.words, 0)
const failures = files
  .filter((f) => f.words > docBudget[f.tier])
  .map((f) => `${f.rel} is ${f.words} words, over the ${docBudget[f.tier]} cap for ${f.tier}`)

if (total > docBudget.authoredTotal) {
  failures.push(
    `authored corpus is ${total} words, over the ${docBudget.authoredTotal} total — cut before you add`,
  )
}

if (failures.length > 0) {
  console.error('Doc budget exceeded — every word here is paid for in agent context:\n')
  for (const line of failures) console.error(`  ${line}`)
  console.error(
    '\nMove detail into a `reference/*.md` an agent opens on demand, or cut it. Rationale and history belong in the commit message (AGENTS.md hard rule 4).',
  )
  process.exit(1)
}

console.log(`lint-doc-budget: ok (${total}/${docBudget.authoredTotal} words authored)`)
