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
  MAX_DOC_SET_TABS,
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
  const wanted = (requested ?? canonicalTabs()).slice(0, MAX_DOC_SET_TABS)
  const manifestPath = join(dir, INTENT_MANIFEST)
  if (existsSync(manifestPath)) {
    return { dir, assetsDir: join(dir, ASSETS_DIR), tabs: wanted, seeded: false }
  }
  writeManifest(dir, wanted)
  return { dir, assetsDir: join(dir, ASSETS_DIR), tabs: wanted, seeded: true }
}

/**
 * cli.ts's `intent prepare` case body, pulled in whole to keep that shrink-only file lean
 * (same reason as canvas-file's `describeSetCanvas`). This is the text an agent reads when
 * it starts an Intent-first unit, so it teaches the convention, not just the paths.
 */
export function describePrepareIntent(repoPath: string, tabs?: string[]): string {
  const prepared = prepareIntent(repoPath, tabs)
  const pinned = prepared.tabs.map((tab) => `  ${tab.file}`).join('\n')
  const seeded = prepared.seeded
    ? `Seeded the tab order:\n${pinned}`
    : `Left the existing meta.json alone (its order and labels are yours):\n${pinned}\n…is what a fresh prepare would have written. Re-pin with \`intent order --files …\` if you want it.`
  return `Intent directory ready at:\n${prepared.dir}\n\n${seeded}

The three tabs we recommend — a convention, not a schema:
  why.md        Why — the motivation and problem as understood BEFORE work started
  approach.md   Approach — the solution shape that was agreed
  decisions.md  Decisions — trade-offs taken, alternatives rejected, scope cut
Add or drop tabs freely and re-pin with \`intent order --files a.md,b.html\`; a file the manifest names but nobody wrote is simply not a tab.

Write the documents with your normal file tools. .md renders as prose; .html renders in a sandboxed frame (its sibling .css and images are inlined for you, so relative paths work). Scripts never run; do not ship a .js. Images go in ${prepared.assetsDir} and are referenced relatively, e.g. <img src="assets/before.png">.`
}

/** Pin the intent tab order (see `orderDocSet`). */
export function orderIntent(repoPath: string, files: string[]): string[] {
  if (files.length > 0) ensureProjectDir(repoPath)
  return orderDocSet(projectIntentDir(repoPath), files, 'intent/')
}

/** The renderable documents in `intent/`, name-sorted. */
export function listIntent(repoPath: string): string[] {
  return listDocSet(projectIntentDir(repoPath))
}
