#!/usr/bin/env node
/**
 * LCH-002 — keep completed migrations and launch discovery free of retired readers.
 *
 * Architecture owns import boundaries and the foundation gate owns the retired Ship/Audit
 * surfaces. This gate owns the final cleanup seam: completed-domain ledgers, zeroed deep-import
 * rows, known home/Evidence compatibility readers, and the minimum fresh-agent discovery path.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMAIN_MIGRATIONS, TARGET_ROOT_DEEP_IMPORT_BASELINES } from './architecture/domains.mjs'
import { checkFoundationDiscovery } from './lint-agent-foundations.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

export const REQUIRED_FRESH_AGENT_FILES = Object.freeze([
  'AGENTS.md',
  'docs/README.md',
  'docs/internals/domain-architecture.md',
  'docs/internals/agent-foundations.md',
  'skills/porcelain-companion/SKILL.md',
  '.agents/skills/web-e2e/SKILL.md',
  '.agents/skills/mobile/SKILL.md',
  '.agents/skills/releasing/SKILL.md',
])

const EXCLUDED_RELATIVE_FILES = new Set([
  'CHANGELOG.md',
  'docs/internals/agent-foundations.md',
  'docs/marketing.md',
  'scripts/lint-agent-foundations.mjs',
  'scripts/lint-agent-foundations.test.mjs',
  'scripts/lint-foundation-ownership.mjs',
  'scripts/lint-foundation-ownership.test.mjs',
  'scripts/lint-launch-cleanup.mjs',
  'scripts/lint-launch-cleanup.test.mjs',
  'scripts/lint-legacy-migrations.mjs',
  // These tests prove that the deleted reader/path cannot return, or model reset disposition;
  // they are not active compatibility readers.
  'apps/cli/src/cli.test.ts',
  'apps/cli/src/evidence-file.test.ts',
  'apps/cli/src/html-input.test.ts',
  'apps/daemon/src/features/review/review-evidence-router.test.ts',
  'apps/daemon/src/project-data/reset-authorization.test.ts',
  'apps/daemon/src/project-data/reset-authorization.ts',
  'apps/daemon/src/features/project-data/companion-policy.test.ts',
  'apps/daemon/src/features/project-data/project-data-ports.test.ts',
  'packages/contracts/src/procedure-catalog.test.ts',
  'packages/contracts/src/review/review.contract.test.ts',
  'packages/contracts/src/review/review.procedures.test.ts',
  'packages/shared/src/project-porcelain.ts',
  'scripts/lint-companion-foundations.test.mjs',
  'skills/porcelain-companion/references/git-visibility.md',
])

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'out',
  'dist',
  'build',
  'coverage',
  '.expo',
  'plans',
  'scripts/agent-scratch',
])
const SCANNED_EXTENSIONS = new Set(['.json', '.md', '.mjs', '.js', '.ts', '.tsx', '.yaml', '.yml'])

const FORBIDDEN_ACTIVE_PATTERNS = Object.freeze([
  ['home Review-set compatibility reader/path', /\breviewSetsPath\b|review-sets\.json/i],
  ['home Evidence compatibility reader/path', /\bloopEvidenceRoot\b|loop-evidence/i],
  [
    'root-level Evidence compatibility reader',
    /\b(?:RETIRED_ROOT_REPORT_FILES|LEGACY_READ_CAP_BYTES|alsoScan|excludeFromAlsoScan)\b/,
  ],
  [
    'retired companion migration reader',
    /\b(?:ensureProjectCompanion|migrateActiveReviewLayout|trustMigratedCommands)\b/,
  ],
  ['retired Feature snapshot path', /feature-view\.json|\bfeature get\b/i],
])

function walk(repositoryRoot, relativeDirectory = '', files = []) {
  const directory = path.join(repositoryRoot, relativeDirectory)
  if (!existsSync(directory)) return files
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name)
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(relativePath) && !EXCLUDED_DIRS.has(entry.name)) {
        walk(repositoryRoot, relativePath, files)
      }
      continue
    }
    if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) files.push(relativePath)
  }
  return files
}

function checkFreshAgentDiscovery(repositoryRoot) {
  const failures = []
  for (const relativePath of REQUIRED_FRESH_AGENT_FILES) {
    if (!existsSync(path.join(repositoryRoot, relativePath))) {
      failures.push(`fresh-agent discovery source is missing: ${relativePath}`)
    }
  }

  const instructionsPath = path.join(repositoryRoot, 'AGENTS.md')
  if (existsSync(instructionsPath)) {
    const instructions = readFileSync(instructionsPath, 'utf8').replace(/\s+/g, ' ')
    for (const requiredText of [
      '## Delivery loop',
      'pnpm verify',
      'Use Porcelain Companion only when intentionally operating',
    ]) {
      if (!instructions.includes(requiredText)) {
        failures.push(`fresh-agent discovery root instructions omit: ${requiredText}`)
      }
    }
  }

  const architecturePath = path.join(repositoryRoot, 'docs/internals/domain-architecture.md')
  if (existsSync(architecturePath)) {
    const architecture = readFileSync(architecturePath, 'utf8')
    for (const requiredText of ['canonical domain paths', 'one narrow `index.ts`']) {
      if (!architecture.includes(requiredText)) {
        failures.push(`fresh-agent discovery domain guide omits: ${requiredText}`)
      }
    }
  }
  return failures
}

/**
 * Read a walked file, or null when it cannot be read.
 *
 * The walk lists directory entries; reading them can still fail — a dangling
 * symlink (gitignored machine-local config pointing at a checkout that moved is
 * the usual one), a permissions problem, a file deleted between the two steps.
 * None of those are evidence of retired text, and crashing the gate with a raw
 * ENOENT stack blocks every commit while telling the developer nothing about
 * what it was actually checking.
 */
function readScannedFile(absolutePath) {
  try {
    return readFileSync(absolutePath, 'utf8')
  } catch {
    return null
  }
}

function checkActiveCompatibilityReaders(repositoryRoot) {
  const failures = []
  for (const relativePath of walk(repositoryRoot)) {
    if (EXCLUDED_RELATIVE_FILES.has(relativePath)) continue
    const source = readScannedFile(path.join(repositoryRoot, relativePath))
    if (source === null) continue
    for (const [label, pattern] of FORBIDDEN_ACTIVE_PATTERNS) {
      if (pattern.test(source)) failures.push(`${relativePath}: contains ${label}`)
    }
  }
  return failures
}

function checkMigrationLedgers(migrations, deepImportBaselines) {
  const failures = []
  if (migrations === null || typeof migrations !== 'object' || Array.isArray(migrations)) {
    failures.push('DOMAIN_MIGRATIONS is not an object')
  } else {
    for (const [domain, record] of Object.entries(migrations)) {
      if (record === null || typeof record !== 'object' || Array.isArray(record)) {
        failures.push(`domain ${domain} migration record is not an object`)
        continue
      }
      if (record.status === 'complete' && Array.isArray(record.legacyPaths)) {
        for (const legacyPath of record.legacyPaths) {
          failures.push(`completed domain ${domain} retains legacy ledger entry: ${legacyPath}`)
        }
      }
    }
  }

  if (
    deepImportBaselines === null ||
    typeof deepImportBaselines !== 'object' ||
    Array.isArray(deepImportBaselines)
  ) {
    failures.push('TARGET_ROOT_DEEP_IMPORT_BASELINES is not an object')
    return failures
  }

  for (const [targetRoot, baseline] of Object.entries(deepImportBaselines)) {
    if (
      baseline !== null &&
      typeof baseline === 'object' &&
      !Array.isArray(baseline) &&
      baseline.occurrences === 0 &&
      baseline.files === 0
    ) {
      failures.push(`zeroed deep-import baseline remains: ${targetRoot}`)
    }
    const owner = Object.entries(migrations ?? {}).find(
      ([, record]) => Array.isArray(record?.targetRoots) && record.targetRoots.includes(targetRoot),
    )
    if (owner?.[1]?.status === 'complete') {
      failures.push(`completed domain ${owner[0]} retains deep-import baseline: ${targetRoot}`)
    }
  }
  return failures
}

/**
 * Check the final migration cleanup and the discovery surfaces a new agent must find.
 * All catalogs are injectable so isolated fixtures can prove each failure without mutating the
 * repository or touching a real Companion directory.
 */
export function checkLaunchCleanup(
  repositoryRoot = root,
  { migrations = DOMAIN_MIGRATIONS, deepImportBaselines = TARGET_ROOT_DEEP_IMPORT_BASELINES } = {},
) {
  return [
    ...checkMigrationLedgers(migrations, deepImportBaselines),
    ...checkActiveCompatibilityReaders(repositoryRoot),
    ...checkFoundationDiscovery(repositoryRoot),
    ...checkFreshAgentDiscovery(repositoryRoot),
  ]
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  const failures = checkLaunchCleanup(root)
  if (failures.length > 0) {
    console.error('lint-launch-cleanup: failed')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
  } else {
    console.log('lint-launch-cleanup: ok — migration ledgers, active readers, and discovery pass')
  }
}
