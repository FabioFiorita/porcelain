#!/usr/bin/env node
/**
 * AGT-003 — keep retired generic foundation routers out of active discovery surfaces.
 *
 * The ownership map retains historical Legacy-source cells as deletion evidence. This checker
 * scans active instructions, procedures, docs, source, and scripts while excluding that map,
 * planning history, and this gate's negative-test vocabulary.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkFoundationOwnership } from './lint-foundation-ownership.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

export const RETIRED_FOUNDATION_PATHS = Object.freeze([
  '.agents/skills/' + 'ship',
  '.agents/skills/' + 'audit',
  '.claude/skills/' + 'ship',
  '.claude/skills/' + 'audit',
  'docs/internals/' + 'audit',
])

export const REQUIRED_DISCOVERY_FILES = Object.freeze([
  'AGENTS.md',
  'plugins/porcelain/skills/porcelain-companion/SKILL.md',
  '.agents/skills/web-e2e/SKILL.md',
  '.agents/skills/mobile/SKILL.md',
  '.agents/skills/releasing/SKILL.md',
])

const EXCLUDED_RELATIVE_FILES = new Set([
  'docs/internals/agent-foundations.md',
  'scripts/lint-agent-foundations.mjs',
  'scripts/lint-agent-foundations.test.mjs',
  'scripts/lint-foundation-ownership.mjs',
  'scripts/lint-foundation-ownership.test.mjs',
])
const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'out',
  'dist',
  'build',
  'coverage',
  'plans',
  'scripts/agent-scratch',
])
const SCANNED_EXTENSIONS = new Set(['.json', '.md', '.mjs', '.js', '.ts', '.tsx', '.yaml', '.yml'])

const RETIRED_TEXT_PATTERNS = Object.freeze([
  ['retired Ship skill path', new RegExp('\\.agents/skills/' + 'ship', 'i')],
  ['retired Audit skill path', new RegExp('\\.agents/skills/' + 'audit', 'i')],
  ['retired Audit docs path', new RegExp('docs/internals/' + 'audit', 'i')],
  ['generic Ship skill instruction', /\bship skill\b/i],
  ['generic Audit skill instruction', /\baudit skill\b/i],
  ['generic Ship skill load instruction', /\bload\s+`?ship`?/i],
  ['generic Audit skill load instruction', /\bload\s+`?audit`?/i],
  ['retired skill catalog row', /\|\s*`(?:ship|audit)`\s*\|/i],
])

function walk(relativeDirectory = '', files = []) {
  const directory = path.join(root, relativeDirectory)
  if (!existsSync(directory)) return files
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name)
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(relativePath) && !EXCLUDED_DIRS.has(entry.name)) {
        walk(relativePath, files)
      }
      continue
    }
    if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) files.push(relativePath)
  }
  return files
}

function activeReferenceFailures() {
  const failures = []
  for (const relativePath of walk()) {
    if (EXCLUDED_RELATIVE_FILES.has(relativePath)) continue
    const source = readFileSync(path.join(root, relativePath), 'utf8')
    for (const [label, pattern] of RETIRED_TEXT_PATTERNS) {
      if (pattern.test(source)) failures.push(`${relativePath}: contains ${label}`)
    }
  }
  return failures
}

/**
 * Validate root discovery, focused procedures, absent retired adapters/docs, and active references.
 * The root is injectable so fixture tests can prove failures without touching host state.
 */
export function checkFoundationDiscovery(repositoryRoot = root) {
  const failures = []
  const originalRoot = root
  if (repositoryRoot !== originalRoot) {
    return checkDiscoveryFixture(repositoryRoot)
  }

  for (const relativePath of RETIRED_FOUNDATION_PATHS) {
    if (existsSync(path.join(repositoryRoot, relativePath))) {
      failures.push(`retired foundation path remains: ${relativePath}`)
    }
  }
  for (const relativePath of REQUIRED_DISCOVERY_FILES) {
    if (!existsSync(path.join(repositoryRoot, relativePath))) {
      failures.push(`required discovery source is missing: ${relativePath}`)
    }
  }

  const instructions = readFileSync(path.join(repositoryRoot, 'AGENTS.md'), 'utf8')
  if (!/^## Delivery loop$/m.test(instructions))
    failures.push('root AGENTS.md is missing Delivery loop')
  if (
    !instructions
      .replace(/\s+/g, ' ')
      .includes('Use Porcelain Companion only when intentionally operating')
  ) {
    failures.push('root AGENTS.md is missing the explicit Companion boundary')
  }
  failures.push(...activeReferenceFailures())
  return failures
}

function checkDiscoveryFixture(repositoryRoot) {
  const failures = []
  for (const relativePath of RETIRED_FOUNDATION_PATHS) {
    if (existsSync(path.join(repositoryRoot, relativePath))) {
      failures.push(`retired foundation path remains: ${relativePath}`)
    }
  }
  for (const relativePath of REQUIRED_DISCOVERY_FILES) {
    if (!existsSync(path.join(repositoryRoot, relativePath))) {
      failures.push(`required discovery source is missing: ${relativePath}`)
    }
  }
  const instructionsPath = path.join(repositoryRoot, 'AGENTS.md')
  if (!existsSync(instructionsPath)) {
    failures.push('root AGENTS.md is missing')
  } else {
    const instructions = readFileSync(instructionsPath, 'utf8')
    if (!/^## Delivery loop$/m.test(instructions))
      failures.push('root AGENTS.md is missing Delivery loop')
    if (
      !instructions
        .replace(/\s+/g, ' ')
        .includes('Use Porcelain Companion only when intentionally operating')
    ) {
      failures.push('root AGENTS.md is missing the explicit Companion boundary')
    }
  }
  for (const relativePath of walkFixture(repositoryRoot)) {
    if (EXCLUDED_RELATIVE_FILES.has(relativePath)) continue
    const source = readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
    for (const [label, pattern] of RETIRED_TEXT_PATTERNS) {
      if (pattern.test(source)) failures.push(`${relativePath}: contains ${label}`)
    }
  }
  return failures
}

function walkFixture(repositoryRoot, relativeDirectory = '', files = []) {
  const directory = path.join(repositoryRoot, relativeDirectory)
  if (!existsSync(directory)) return files
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name)
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(relativePath) && !EXCLUDED_DIRS.has(entry.name)) {
        walkFixture(repositoryRoot, relativePath, files)
      }
    } else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(relativePath)
    }
  }
  return files
}

export function checkAgentFoundations(repositoryRoot = root) {
  return [...checkFoundationDiscovery(repositoryRoot), ...checkFoundationOwnership(repositoryRoot)]
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  const failures = checkAgentFoundations(root)
  if (failures.length > 0) {
    console.error('lint-agent-foundations: failed')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
  } else {
    console.log(
      'lint-agent-foundations: ok — root discovery and retired foundation removal are sound',
    )
  }
}
