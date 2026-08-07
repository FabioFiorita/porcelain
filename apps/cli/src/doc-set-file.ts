import { mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { INTENT_MANIFEST } from '@shared/project-porcelain'

/**
 * The document-set primitive, shared by the two directories that use it: Intent
 * (`active-review/intent/`) and the Results sub-tab of Evidence
 * (`active-review/evidence/results/`).
 *
 * Both are "drop files in a directory, pin the tab order in `meta.json`", so the
 * validation and the atomic manifest write live here once rather than being
 * copied per noun — the daemon reads one shape (`{ tabs: [{ file, label? }] }`)
 * and a second hand-rolled writer is how the two drift.
 */

/** Lockstep with `MAX_DOCS` in apps/daemon/src/review/doc-set.ts. */
export const MAX_TABS = 12

export interface ManifestTab {
  file: string
  label?: string
}

/**
 * A file name and nothing else. The manifest names reach `readFile` in the
 * daemon, and a `--files ../../etc/passwd` must fail here, loudly, rather than
 * be silently filtered later.
 */
function assertPlainNames(files: string[], where: string): void {
  const bad = files.filter((f) => f.includes('/') || f.includes('\\') || f.startsWith('.'))
  if (bad.length > 0) {
    throw new Error(`--files takes plain file names inside ${where}, not paths: ${bad.join(', ')}`)
  }
}

/** Atomic like every other channel write — a half-written manifest reads as none. */
export function writeManifest(dir: string, tabs: ManifestTab[]): string[] {
  const capped = tabs.slice(0, MAX_TABS)
  const path = join(dir, INTENT_MANIFEST)
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify({ tabs: capped }, null, 2))
  renameSync(tmp, path)
  return capped.map((tab) => tab.file)
}

/**
 * Pin tab order for a document set. Without a manifest the app falls back to
 * file-name order, which is fine for one document and arbitrary for five — and
 * `readdir` order is not even stable across platforms.
 *
 * Every named file must already be on disk: a manifest entry for a document
 * nobody wrote is a tab that silently never appears.
 */
export function orderDocSet(dir: string, files: string[], where: string): string[] {
  if (files.length === 0) throw new Error('pass at least one --file')
  assertPlainNames(files, where)
  mkdirSync(dir, { recursive: true })
  const present = new Set(readdirSync(dir))
  const missing = files.filter((f) => !present.has(f))
  if (missing.length > 0) {
    throw new Error(`not in ${dir}: ${missing.join(', ')} — write the documents first`)
  }
  return writeManifest(
    dir,
    files.map((file) => ({ file })),
  )
}

/** Everything in the directory, name-sorted; a missing directory lists as empty. */
export function listDocSet(dir: string): string[] {
  try {
    return readdirSync(dir).sort()
  } catch {
    return []
  }
}

/** `why.md` → "Why"; `before-after.html` → "Before after". */
export function labelFor(file: string): string {
  const dot = file.lastIndexOf('.')
  const base = (dot === -1 ? file : file.slice(0, dot)).replace(/[-_]+/g, ' ')
  return base.charAt(0).toUpperCase() + base.slice(1)
}
