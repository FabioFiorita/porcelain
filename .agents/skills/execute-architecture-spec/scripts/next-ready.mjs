#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

function fail(message) {
  console.error(`execute-architecture-spec: ${message}`)
  process.exit(1)
}

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
if (path.resolve(process.cwd()) !== path.resolve(root)) {
  fail(`run from the repository root: ${root}`)
}

const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
if (status !== '') fail('worktree is not clean; stop instead of absorbing existing changes')

try {
  execFileSync('node', ['scripts/lint-architecture-specs.mjs'], { cwd: root, stdio: 'inherit' })
} catch {
  fail('architecture recipe catalog is invalid')
}

const specsRoot = path.join(root, 'plans', 'architecture-refactor', 'specs')
const catalog = readFileSync(path.join(specsRoot, 'catalog.md'), 'utf8')
const catalogStatuses = new Map()
for (const match of catalog.matchAll(
  /^\| `([A-Z][A-Z0-9]*-\d{3})` \| (Landed|Draft|Ready|Blocked) \|/gm,
)) {
  catalogStatuses.set(match[1], match[2])
}

const ready = [...catalogStatuses].filter(([, recipeStatus]) => recipeStatus === 'Ready')
if (ready.length === 0) {
  const nextDraft = [...catalogStatuses].find(([, recipeStatus]) => recipeStatus === 'Draft')?.[0]
  fail(
    `no Ready recipe; an architecture reviewer must preflight${nextDraft ? ` ${nextDraft}` : ' the next unit'}`,
  )
}
if (ready.length !== 1) {
  fail(`expected exactly one Ready recipe, found ${ready.map(([id]) => id).join(', ')}`)
}

const id = ready[0][0]
const matches = readdirSync(specsRoot).filter((name) => name === `${id}.md` || name.startsWith(`${id}-`))
if (matches.length !== 1) fail(`${id} must resolve to exactly one recipe file`)

const recipePath = path.join(specsRoot, matches[0])
const recipe = readFileSync(recipePath, 'utf8')
if (!new RegExp(`^# ${id} — .+$`, 'm').test(recipe) || !/^- Status: Ready$/m.test(recipe)) {
  fail(`${matches[0]} does not declare the selected Ready recipe`)
}

const depends = /^- Depends on: (.+)$/m.exec(recipe)?.[1] ?? ''
const dependencyIds = [...depends.matchAll(/[A-Z][A-Z0-9]*-\d{3}/g)].map((match) => match[0])
const unlanded = dependencyIds.filter((dependency) => catalogStatuses.get(dependency) !== 'Landed')
if (unlanded.length > 0) fail(`${id} has unlanded dependencies: ${unlanded.join(', ')}`)

const startingCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
console.log(`READY_RECIPE=${id}`)
console.log(`RECIPE_PATH=${path.relative(root, recipePath)}`)
console.log(`STARTING_COMMIT=${startingCommit}`)
