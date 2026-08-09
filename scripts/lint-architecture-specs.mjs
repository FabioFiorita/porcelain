#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const specsRoot = path.join(root, 'plans', 'architecture-refactor', 'specs')
const catalogPath = path.join(specsRoot, 'catalog.md')
const catalog = readFileSync(catalogPath, 'utf8')
const failures = []

const catalogEntries = new Map()
for (const match of catalog.matchAll(/^\| `([A-Z]+-\d{3})` \| (Landed|Draft|Ready|Blocked) \|/gm)) {
  const [, id, status] = match
  if (catalogEntries.has(id)) failures.push(`catalog duplicates ${id}`)
  catalogEntries.set(id, status)
}

const statedCount = /There are (\d+) bounded units\./.exec(catalog)?.[1]
if (statedCount === undefined || Number(statedCount) !== catalogEntries.size) {
  failures.push(
    `catalog count says ${statedCount ?? 'nothing'} but contains ${catalogEntries.size} unit rows`,
  )
}

const requiredSections = [
  'Objective',
  'Why this unit exists',
  'Current behavior and evidence',
  'Scope',
  'Non-goals',
  'Target ownership and public surface',
  'Behavior to preserve',
  'Legacy behavior to delete',
  'Ordered implementation',
  'Tests',
  'Validation and evidence',
  'Forbidden shortcuts',
  'Completion criteria',
  'Handoff',
]

const recipeFiles = readdirSync(specsRoot)
  .filter((name) => name.endsWith('.md') && !['README.md', 'catalog.md'].includes(name))
  .sort()

const recipeIds = new Set()
for (const name of recipeFiles) {
  const source = readFileSync(path.join(specsRoot, name), 'utf8')
  const title = /^# ([A-Z]+-\d{3}) — .+$/m.exec(source)
  if (!title) {
    failures.push(`${name} has no exact “# ID — outcome” title`)
    continue
  }

  const id = title[1]
  if (!name.startsWith(id)) failures.push(`${name} must start with its recipe id ${id}`)
  if (recipeIds.has(id)) failures.push(`more than one recipe file owns ${id}`)
  recipeIds.add(id)

  const catalogStatus = catalogEntries.get(id)
  if (!catalogStatus) failures.push(`${name} has no catalog row for ${id}`)

  const status = /^- Status: (Landed|Draft|Ready|Blocked)$/m.exec(source)?.[1]
  if (!status) failures.push(`${name} has no valid Status metadata`)
  else if (catalogStatus !== status) {
    failures.push(`${name} is ${status} but its catalog row is ${catalogStatus}`)
  }

  for (const field of ['Batch', 'Domain', 'Depends on', 'Governing decisions']) {
    if (!new RegExp(`^- ${field}: \\S`, 'm').test(source)) {
      failures.push(`${name} has no ${field} metadata`)
    }
  }
  if (!/^- Primary exemplar: (?:yes|no)$/m.test(source)) {
    failures.push(`${name} Primary exemplar must be yes or no`)
  }

  let previousSection = -1
  for (const section of requiredSections) {
    const heading = `## ${section}`
    const first = source.indexOf(heading)
    const second = first === -1 ? -1 : source.indexOf(heading, first + heading.length)
    if (first === -1) failures.push(`${name} is missing “${heading}”`)
    else if (second !== -1) failures.push(`${name} duplicates “${heading}”`)
    else if (first < previousSection) failures.push(`${name} places “${heading}” out of order`)
    previousSection = Math.max(previousSection, first)
  }

  const depends = /^- Depends on: (.+)$/m.exec(source)?.[1] ?? ''
  const dependencyIds = [...depends.matchAll(/[A-Z]+-\d{3}/g)].map((match) => match[0])
  for (const dependency of dependencyIds) {
    if (!catalogEntries.has(dependency)) {
      failures.push(`${name} depends on unknown catalog id ${dependency}`)
    }
  }
  if (status === 'Ready') {
    for (const dependency of dependencyIds) {
      if (catalogEntries.get(dependency) !== 'Landed') {
        failures.push(`${name} is Ready but ${dependency} is not Landed`)
      }
    }
  }

  if (/\b(?:TBD|TODO)\b/.test(source) || /as appropriate|to be decided|if needed/i.test(source)) {
    failures.push(`${name} delegates judgment with placeholder language`)
  }
  if (source.includes('/home/fabiofiorita/')) {
    failures.push(`${name} contains a host-personal absolute path`)
  }
}

if (failures.length > 0) {
  console.error('Architecture specification drift:\n')
  for (const failure of failures) console.error(`  ${failure}`)
  console.error('\nRepair the recipe or catalog; do not weaken the executor contract.')
  process.exit(1)
}

console.log(
  `lint-architecture-specs: ok — ${catalogEntries.size} catalog units; ${recipeIds.size} full recipes`,
)
