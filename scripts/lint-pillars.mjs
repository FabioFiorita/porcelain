#!/usr/bin/env node
/**
 * Every feature directory names the pillar it serves.
 *
 * Nineteen lint gates check *structure*; not one of them asks what a surface is FOR. That is how
 * harness-era surfaces survived every pivot — they were well-formed, so nothing ever objected.
 * This gate closes that hole: a directory absent from the manifest fails, so a new surface cannot
 * appear without someone naming its pillar, and a deleted one cannot linger in the manifest either.
 *
 * Statuses are `pillar-1`..`pillar-6` (docs/product.md), `supporting`, or `frozen`.
 * The manifest is scripts/quality/pillar-manifest.json.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Parent roots whose immediate subdirectories must each declare a pillar. */
export const WATCHED_ROOTS = [
  'apps/web/src/features',
  'apps/web/src/components',
  'apps/daemon/src/features',
  'apps/mobile/src/features',
  'apps/mobile/src/components',
]

const PILLARS = new Set([
  'pillar-1',
  'pillar-2',
  'pillar-3',
  'pillar-4',
  'pillar-5',
  'pillar-6',
  'supporting',
  'frozen',
])

/** Directories present on disk under every watched root, as repo-relative posix paths. */
export function scanDirectories(baseDir, roots = WATCHED_ROOTS) {
  const found = []
  for (const rootPath of roots) {
    const absolute = join(baseDir, rootPath)
    if (!existsSync(absolute)) continue
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.isDirectory()) found.push(posix.join(rootPath, entry.name))
    }
  }
  return found.sort()
}

/**
 * Compare the manifest against what is on disk. Both directions fail: an undeclared directory
 * means a surface nobody justified, a stale entry means the manifest is describing a fiction.
 */
export function checkPillars(manifest, directories) {
  const problems = []
  const declared = manifest?.directories ?? {}

  for (const dir of directories) {
    const status = declared[dir]
    if (status === undefined) {
      problems.push(
        `${dir} declares no pillar — add it to scripts/quality/pillar-manifest.json, or delete it.`,
      )
    } else if (!PILLARS.has(status)) {
      problems.push(
        `${dir} has unknown status "${status}"; expected one of ${[...PILLARS].join(', ')}.`,
      )
    }
  }

  const onDisk = new Set(directories)
  for (const dir of Object.keys(declared)) {
    if (!onDisk.has(dir)) {
      problems.push(`${dir} is in the manifest but not on disk — remove the stale entry.`)
    }
  }

  return problems
}

function main() {
  const manifestPath = join(root, 'scripts', 'quality', 'pillar-manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const directories = scanDirectories(root)
  const problems = checkPillars(manifest, directories)

  if (problems.length > 0) {
    console.error('lint-pillars: every feature directory must name the pillar it serves.\n')
    for (const problem of problems) console.error(`  • ${problem}`)
    console.error(
      '\nPillars are defined in docs/product.md. A directory that serves no pillar is a deletion' +
        '\ncandidate, not a keeper — that is the default this gate exists to enforce.',
    )
    process.exit(1)
  }

  const counts = new Map()
  for (const status of Object.values(manifest.directories)) {
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }
  const summary = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `${status} ${count}`)
    .join(' · ')
  console.log(`lint-pillars: ok — ${directories.length} directories declared (${summary})`)
}

if (relative(root, process.argv[1] ?? '') === join('scripts', 'lint-pillars.mjs')) main()
