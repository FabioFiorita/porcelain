import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  ASSETS_DIR,
  INTENT_CANONICAL_TABS,
  INTENT_MANIFEST,
  projectIntentDir,
} from '@shared/project-porcelain'
import {
  labelFor,
  listDocSet,
  MAX_TABS,
  type ManifestTab,
  orderDocSet,
  writeManifest,
} from './doc-set-file'
import { ensureProjectDir } from './project-io'

/**
 * `porcelain intent prepare` — make `.porcelain/active-review/intent/`, seed the
 * recommended tab order, and hand back the paths.
 *
 * Same shape as `evidence prepare`, and for the same reason: an agent writes
 * documents with its normal file tools, and a large payload must never ride a
 * channel argument. The CLI's whole job here is to name the directory, propose
 * a starting shape, and fix the tab order.
 */

export interface PreparedIntent {
  dir: string
  assetsDir: string
  /** The manifest order, canonical or `--tabs`, in tab order. */
  tabs: ManifestTab[]
  /** False when a manifest was already there and was left exactly as it was. */
  seeded: boolean
}

/**
 * Turn a `--tabs` token into a manifest entry: `why` → `why.md` "Why",
 * `before-after.html` → `before-after.html` "Before after". A bare name gets
 * `.md` because prose is the default medium and the alternative is an agent
 * writing `why` and wondering why no tab appeared.
 */
function toTab(raw: string): ManifestTab {
  const name = raw.trim()
  if (name === '') throw new Error('--tabs entries must be non-empty')
  if (name.includes('/') || name.includes('\\') || name.startsWith('.')) {
    throw new Error(`--tabs takes plain file names inside intent/, not paths: ${name}`)
  }
  const file = /\.[a-z]+$/i.test(name) ? name : `${name}.md`
  return { file, label: labelFor(file) }
}

function canonicalTabs(): ManifestTab[] {
  return INTENT_CANONICAL_TABS.map((tab) => ({ file: tab.file, label: tab.label }))
}

/**
 * Create the directory (and its `assets/` home) and, when there is no manifest
 * yet, seed one with the recommended tab order.
 *
 * Seeding a manifest for files nobody has written yet is safe on purpose:
 * `readDocSet` filters the manifest against what is actually on disk, so an
 * unwritten `decisions.md` is simply not a tab. And re-running `prepare` NEVER
 * touches an existing manifest — an agent that re-pinned its own order with
 * `intent order`, or renamed a tab, must not have that undone by a second
 * scaffold call.
 */
export function prepareIntent(repoPath: string, tabs?: string[]): PreparedIntent {
  ensureProjectDir(repoPath)
  const dir = projectIntentDir(repoPath)
  mkdirSync(join(dir, ASSETS_DIR), { recursive: true })
  const requested = tabs?.map(toTab)
  if (requested !== undefined && requested.length === 0) {
    throw new Error('--tabs needs at least one name, e.g. --tabs why,approach,decisions')
  }
  const wanted = (requested ?? canonicalTabs()).slice(0, MAX_TABS)
  const manifestPath = join(dir, INTENT_MANIFEST)
  if (existsSync(manifestPath)) {
    return { dir, assetsDir: join(dir, ASSETS_DIR), tabs: wanted, seeded: false }
  }
  writeManifest(dir, wanted)
  return { dir, assetsDir: join(dir, ASSETS_DIR), tabs: wanted, seeded: true }
}

/** Pin the intent tab order (see `orderDocSet`). */
export function orderIntent(repoPath: string, files: string[]): string[] {
  if (files.length > 0) ensureProjectDir(repoPath)
  return orderDocSet(projectIntentDir(repoPath), files, 'intent/')
}

export function listIntent(repoPath: string): string[] {
  return listDocSet(projectIntentDir(repoPath))
}
