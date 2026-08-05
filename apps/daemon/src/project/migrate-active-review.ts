import { mkdir, rename, stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  PROJECT_EVIDENCE_DIR,
  PROJECT_INTENT_DIR,
  projectActiveReviewDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'

/**
 * Fold a flat companion into `active-review/`.
 *
 * The review in flight used to sit loose at the companion root — `review.json`,
 * `comments.json`, `reviewed.json`, `intent/`, `evidence/` — beside durable
 * project data and beside `reviews/`, which made the root hard to read and made
 * the active review shaped differently from every archived one.
 *
 * One-way and non-destructive: each slot moves only when the destination is
 * free, so a half-finished run is safe to repeat and never clobbers newer data.
 */

const SLOTS = [
  'review.json',
  'comments.json',
  'reviewed.json',
  PROJECT_INTENT_DIR,
  PROJECT_EVIDENCE_DIR,
] as const

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function migrateActiveReviewLayout(repoPath: string): Promise<{ moved: string[] }> {
  const legacy = SLOTS.map((slot) => ({ slot, from: projectPorcelainPath(repoPath, slot) }))
  const present: Array<{ slot: string; from: string }> = []
  for (const entry of legacy) {
    if (await exists(entry.from)) present.push(entry)
  }
  if (present.length === 0) return { moved: [] }

  const dest = projectActiveReviewDir(repoPath)
  await mkdir(dest, { recursive: true })
  const moved: string[] = []
  for (const entry of present) {
    const to = join(dest, entry.slot)
    // Never overwrite: if the new layout already has this slot, the old file is
    // stale and the human can delete it themselves.
    if (await exists(to)) continue
    try {
      await rename(entry.from, to)
      moved.push(entry.slot)
    } catch {
      // cross-device or permissions — leave it; the surface reads empty, not wrong
    }
  }
  return { moved }
}
