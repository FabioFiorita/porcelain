import { mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ASSETS_DIR, INTENT_MANIFEST, projectIntentDir } from '@shared/project-porcelain'
import { ensureProjectDir } from './project-io'

/**
 * `porcelain intent prepare` — make `.porcelain/intent/` and hand back the path.
 *
 * Same shape as `evidence prepare`, and for the same reason: an agent writes
 * documents with its normal file tools, and a large payload must never ride a
 * channel argument. The CLI's whole job here is to name the directory and,
 * optionally, fix the tab order.
 */

const MAX_TABS = 12

export interface PreparedIntent {
  dir: string
  assetsDir: string
}

export function prepareIntent(repoPath: string): PreparedIntent {
  ensureProjectDir(repoPath)
  const dir = projectIntentDir(repoPath)
  mkdirSync(join(dir, ASSETS_DIR), { recursive: true })
  return { dir, assetsDir: join(dir, ASSETS_DIR) }
}

/**
 * Pin tab order. Without a manifest the app falls back to file-name order, which
 * is fine for one document and arbitrary for five — and `readdir` order is not
 * even stable across platforms.
 */
export function orderIntent(repoPath: string, files: string[]): string[] {
  if (files.length === 0) throw new Error('pass at least one --file')
  const bad = files.filter((f) => f.includes('/') || f.includes('\\') || f.startsWith('.'))
  if (bad.length > 0) {
    throw new Error(`--file takes plain file names inside intent/, not paths: ${bad.join(', ')}`)
  }
  const dir = prepareIntent(repoPath).dir
  const present = new Set(readdirSync(dir))
  const missing = files.filter((f) => !present.has(f))
  if (missing.length > 0) {
    throw new Error(`not in ${dir}: ${missing.join(', ')} — write the documents first`)
  }
  const tabs = files.slice(0, MAX_TABS).map((file) => ({ file }))
  const path = join(dir, INTENT_MANIFEST)
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify({ tabs }, null, 2))
  // Atomic like every other channel write — a half-written manifest reads as none.
  renameSync(tmp, path)
  return tabs.map((t) => t.file)
}

export function listIntent(repoPath: string): string[] {
  try {
    return readdirSync(projectIntentDir(repoPath)).sort()
  } catch {
    return []
  }
}
