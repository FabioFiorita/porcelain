import { type Dirent, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type DocSetTab,
  docSetLabelFor,
  docSetMediumFor,
  MAX_DOC_SET_TABS,
  serializeDocSetFile,
} from '@shared/doc-set-file'
import { INTENT_MANIFEST } from '@shared/project-porcelain'

/**
 * The document-set primitive, shared by the two directories that use it: Intent
 * (`active-review/intent/`) and the Results sub-tab of Evidence
 * (`active-review/evidence/results/`).
 *
 * Both are "drop files in a directory, pin the tab order in `meta.json`". The
 * manifest shape, its caps, the renderable media, and the label derivation are
 * NOT described here: `@shared/doc-set-file` owns them, and the daemon reader
 * parses what this writes with that same module. This file is only the Node
 * half — the atomic write and the directory checks a browser could not do.
 */

export { MAX_DOC_SET_TABS } from '@shared/doc-set-file'

export type ManifestTab = DocSetTab

/** `why.md` → "Why"; `before-after.html` → "Before after". */
export const labelFor = docSetLabelFor

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
  const capped = tabs.slice(0, MAX_DOC_SET_TABS)
  const path = join(dir, INTENT_MANIFEST)
  const tmp = `${path}.tmp`
  writeFileSync(tmp, serializeDocSetFile(capped))
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

/**
 * The renderable documents in the directory, name-sorted; a missing directory
 * lists as empty.
 *
 * A raw `readdir` here answered a question nobody asked: `intent list` printed
 * `assets`, `meta.json` and every dotfile beside the two documents, so an agent
 * reading the output could not tell what the human would actually see as tabs.
 * The listing matches what the daemon's `readDocSet` will show — files only, the
 * two renderable media only.
 */
export function listDocSet(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter(
      (entry) =>
        entry.isFile() && !entry.name.startsWith('.') && docSetMediumFor(entry.name) !== null,
    )
    .map((entry) => entry.name)
    .sort()
}
