#!/usr/bin/env node
/**
 * One writer: only the daemon may write the Porcelain home.
 *
 * The retired agent CLI resolved `$PORCELAIN_HOME` and wrote it directly —
 * a second implementation of the daemon's Project Data write path, kept in step by hand
 * ("Mirrors daemon project-channel atomic tmp+rename"). Deleting it fixes today; this
 * gate is what stops it growing back, because the next helper that "just needs to drop a
 * file in ~/.porcelain" will look reasonable in review.
 *
 * The rule: a file that resolves a Porcelain-home path AND calls a filesystem write must
 * live under `apps/daemon/src/`. Reading is unrestricted — a script that reports what is
 * there is not a second writer.
 *
 * Usage:
 *   node scripts/lint-one-writer.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

/** Where the one writer lives. Everything else may read. */
export const WRITER_ROOT = 'apps/daemon/src'

const SCANNED_ROOTS = ['apps', 'packages', 'scripts']
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'build', 'coverage', '.stryker-tmp'])
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js']

/** Resolving a path under the Porcelain home. */
const HOME_PATTERNS = [
  /\bporcelainHome\b/,
  /\bporcelainHomePath\b/,
  /porcelain-home/,
  /canvasBundleDir|canvasIndexPath|projectCanvasesDir/,
  /tasksIndexPath|taskAttachmentPath/,
]

/** Putting bytes on disk. `rm` counts: deleting someone else's store is a write. */
const WRITE_PATTERNS = [
  /\bwriteFileSync?\b/,
  /\bappendFileSync?\b/,
  /\bmkdirSync?\b/,
  /\brenameSync?\b/,
  /\bcpSync?\b/,
  /\brmSync?\b/,
  /\brmdirSync?\b/,
  /\bunlinkSync?\b/,
  /\bcopyFileSync?\b/,
]

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    let stats
    try {
      stats = statSync(full)
    } catch {
      continue
    }
    if (stats.isDirectory()) walk(full, out)
    else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) out.push(full)
  }
  return out
}

const matches = (patterns, source) => patterns.some((pattern) => pattern.test(source))

/**
 * Writers outside the daemon that are not Project Data, each with the reason it is
 * not the thing this gate is about. Keep this list at zero-or-explicit; the paired
 * test fails if an entry names a file that no longer exists, so it cannot rot.
 */
export const ALLOWED = Object.freeze({
  // Mints `~/.porcelain/admin-token` for a host that has no daemon running yet. Host
  // credential bootstrap, not Project Data — the daemon does the same thing on boot.
  'scripts/daemon-cli.js': 'admin-token bootstrap for the published daemon package',
  // These two describe the patterns; naming them is not performing them.
  'scripts/lint-one-writer.mjs': 'this gate',
  'scripts/lint-one-writer.test.mjs': 'this gate proof',
})

/**
 * Pure so the paired test can drive both verdicts without a fixture tree.
 * `relativePath` uses forward slashes.
 */
export function isSecondWriter(relativePath, source) {
  if (relativePath.startsWith(`${WRITER_ROOT}/`)) return false
  if (relativePath in ALLOWED) return false
  return matches(HOME_PATTERNS, source) && matches(WRITE_PATTERNS, source)
}

export function findSecondWriters(repositoryRoot = root) {
  const offenders = []
  for (const scanned of SCANNED_ROOTS) {
    for (const file of walk(join(repositoryRoot, scanned))) {
      const relativePath = relative(repositoryRoot, file).split('\\').join('/')
      if (isSecondWriter(relativePath, readFileSync(file, 'utf8'))) offenders.push(relativePath)
    }
  }
  return offenders.sort()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const offenders = findSecondWriters()
  if (offenders.length > 0) {
    console.error('Second writer to the Porcelain home — only the daemon may write it:')
    for (const offender of offenders) console.error(`  ${offender}`)
    console.error(
      `Move the write behind a daemon operation under ${WRITER_ROOT}/, or read instead of writing.`,
    )
    process.exit(1)
  }
  console.log('lint-one-writer: ok — the daemon is the only writer of the Porcelain home')
}
