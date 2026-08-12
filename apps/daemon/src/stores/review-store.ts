import { randomBytes } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { access, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import {
  ACTIVE_FILES,
  activeReviewPath,
  PROJECT_EVIDENCE_DIR,
  PROJECT_FILES,
  PROJECT_INTENT_DIR,
  projectActiveReviewDir,
  projectArchivedReviewDir,
  projectPorcelainPath,
  projectReviewsDir,
} from '@shared/project-porcelain'
import { z } from 'zod'
import { gitForceStage } from '../git/git'
import { createProjectChannel } from '../net/project-channel'
import { recordPublishedReview } from '../project/companion-disposition'
import {
  type ReviewSection,
  type ReviewSet,
  reviewSectionSchema,
  reviewSetSchema,
} from '../review/review-set'

/**
 * True when `entryPath` stays inside `repoPath`. Rejects absolute paths and
 * `..`-escapes — the review file is owned by an untrusted external process.
 */
export function isRepoContained(repoPath: string, entryPath: string): boolean {
  if (isAbsolute(entryPath)) return false
  const rel = relative(repoPath, resolve(repoPath, entryPath))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Active review set — `<repo>/.porcelain/review.json`. CLI authors; app reads and
 * archives on clear. Previous reviews live under `.porcelain/reviews/<id>/`.
 */

const lenientReviewSetSchema = reviewSetSchema.extend({
  sections: z.array(z.unknown()).default([]),
})

const channel = createProjectChannel({
  fileName: ACTIVE_FILES.review,
  schema: lenientReviewSetSchema,
  empty: (): z.infer<typeof lenientReviewSetSchema> => ({
    name: '',
    files: [],
    sections: [],
  }),
})

export function reviewPath(repoPath: string): string {
  return channel.path(repoPath)
}

/** @deprecated use reviewPath — kept name for older call sites during transition. */
export function reviewSetsPath(repoPath?: string): string {
  if (repoPath) return reviewPath(repoPath)
  // Home path no longer holds review sets; tests should pass repoPath.
  return projectPorcelainPath('', ACTIVE_FILES.review)
}

const MAX_SECTIONS = 30

const archivedMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  thesis: z.string().optional(),
  archivedAt: z.string(),
})
export type ArchivedReviewMeta = z.infer<typeof archivedMetaSchema>

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function sanitizeReview(repoPath: string, set: z.infer<typeof lenientReviewSetSchema>): ReviewSet {
  if (!set.name) {
    return { name: '', files: [], sections: [] }
  }
  const sections = set.sections.slice(0, MAX_SECTIONS).flatMap((section): ReviewSection[] => {
    const parsed = reviewSectionSchema.safeParse(section)
    if (!parsed.success) return []
    return [
      {
        ...parsed.data,
        anchors: parsed.data.anchors.filter((anchor) => isRepoContained(repoPath, anchor.path)),
      },
    ]
  })
  return {
    ...set,
    files: set.files.filter((file) => isRepoContained(repoPath, file.path)),
    sections,
  }
}

/** The active agent-fed review set, or null if none / empty name. */
export async function readReviewSet(repoPath: string): Promise<ReviewSet | null> {
  try {
    const raw = await readFile(reviewPath(repoPath), 'utf8')
    const set = lenientReviewSetSchema.parse(JSON.parse(raw))
    if (!set.name) return null
    return sanitizeReview(repoPath, set)
  } catch {
    return null
  }
}

function newArchiveId(): string {
  return `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
}

/**
 * Archive the active review (review + comments + reviewed + evidence) under
 * `.porcelain/reviews/<id>/`, then clear the active slots. No-op if there is
 * nothing active. Returns the new archive id or null.
 */
export async function archiveActiveReview(repoPath: string): Promise<string | null> {
  const set = await readReviewSet(repoPath)
  const activeDir = projectActiveReviewDir(repoPath)
  if (!(await pathExists(activeDir))) return null

  const id = newArchiveId()
  const dest = projectArchivedReviewDir(repoPath, id)
  await mkdir(join(dest, '..'), { recursive: true })

  // A directory copy, because the active review is shaped exactly like an
  // archived one — no per-slot list to keep in sync as the shape grows.
  await cp(activeDir, dest, { recursive: true })

  const meta: ArchivedReviewMeta = {
    id,
    name: set?.name ?? 'Untitled review',
    ...(set?.thesis ? { thesis: set.thesis } : {}),
    archivedAt: new Date().toISOString(),
  }
  await writeFile(join(dest, 'meta.json'), JSON.stringify(meta, null, 2))

  // The copy already landed; a failure here would leave the review both archived and
  // active, so it must reach the caller instead of settling quietly.
  await rm(activeDir, { recursive: true, force: true })
  return id
}

/**
 * Archive the active review (if any) and clear active slots — the human's
 * "done with this unit" path. Prefer this over hard-delete.
 */
export async function clearReviewSet(repoPath: string): Promise<void> {
  await archiveActiveReview(repoPath)
}

/** Recursive byte + file count for a directory. Missing dir reads as zero. */
async function dirCost(dir: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0
  let files = 0
  const walk = async (current: string): Promise<void> => {
    let entries: Dirent[]
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
        continue
      }
      try {
        bytes += (await stat(path)).size
        files += 1
      } catch {
        // vanished mid-walk — the estimate is advisory
      }
    }
  }
  await walk(dir)
  return { bytes, files }
}

export interface PublishCost {
  bytes: number
  files: number
}

/**
 * What publishing the active review would add to git history, measured before
 * the human commits to it. Evidence packs are the reason this exists: a review
 * is worth sharing, and a 30 MB capture inside it is worth knowing about first,
 * because history does not forget.
 */
export async function activeReviewCost(repoPath: string): Promise<PublishCost> {
  // One walk: the active review is a single directory now.
  return dirCost(projectActiveReviewDir(repoPath))
}

export interface PublishResult {
  id: string
  cost: PublishCost
}

/**
 * Archive the active review and stage it for the team. Reviews are Local by
 * default, so this force-adds past `.gitignore` — the one place in the app that
 * does, and only because the human just asked for exactly this path.
 *
 * It stages rather than commits: what goes in a commit stays the human's call,
 * the same rule `gitCommit` follows by never auto-staging.
 */
export async function publishActiveReview(repoPath: string): Promise<PublishResult | null> {
  const cost = await activeReviewCost(repoPath)
  const id = await archiveActiveReview(repoPath)
  if (id === null) return null
  // The durable half: a negation rule the team can read, and which travels with
  // the commit. It also lifts the clone-wide exclude, without which it is inert.
  await recordPublishedReview(repoPath, id)
  // The immediate half: stage it now so the human sees it in Changes.
  await gitForceStage(repoPath, relative(repoPath, projectArchivedReviewDir(repoPath, id)))
  return { id, cost }
}

/** List archived reviews, newest first. */
export async function listArchivedReviews(repoPath: string): Promise<ArchivedReviewMeta[]> {
  const root = projectReviewsDir(repoPath)
  let entries: string[]
  try {
    entries = await readdir(root)
  } catch {
    return []
  }
  const metas: ArchivedReviewMeta[] = []
  for (const id of entries) {
    try {
      const raw = await readFile(join(root, id, 'meta.json'), 'utf8')
      const parsed = archivedMetaSchema.safeParse(JSON.parse(raw))
      if (parsed.success) metas.push(parsed.data)
    } catch {
      // skip corrupt / partial archives
    }
  }
  return metas.sort((a, b) => (a.archivedAt < b.archivedAt ? 1 : -1))
}

/** Permanently delete an archived review. */
export async function deleteArchivedReview(repoPath: string, id: string): Promise<void> {
  if (id.includes('/') || id.includes('..') || id === '') {
    throw new Error('invalid review id')
  }
  await rm(projectArchivedReviewDir(repoPath, id), { recursive: true, force: true })
}

/**
 * Restore an archived review as active. Archives the current active review first
 * (if any), then copies the chosen archive into the active slots.
 *
 * The destinations are the ACTIVE-review paths, not the companion root. An
 * archive is shaped exactly like `active-review/`, and every reader
 * (`ACTIVE_FILES` / `activeReviewPath`) looks inside that directory — restoring
 * to the flat legacy paths landed the files where nothing reads them, so a
 * restored review came back empty.
 */
export async function restoreArchivedReview(repoPath: string, id: string): Promise<void> {
  if (id.includes('/') || id.includes('..') || id === '') {
    throw new Error('invalid review id')
  }
  const src = projectArchivedReviewDir(repoPath, id)
  if (!(await pathExists(src))) throw new Error(`archived review not found: ${id}`)

  await archiveActiveReview(repoPath)
  await mkdir(projectActiveReviewDir(repoPath), { recursive: true })

  // Same shape on both sides: the archive's file name is its active name.
  for (const file of [PROJECT_FILES.review, PROJECT_FILES.comments, PROJECT_FILES.reviewed]) {
    const from = join(src, file)
    if (await pathExists(from)) await cp(from, activeReviewPath(repoPath, file))
  }
  for (const dir of [PROJECT_EVIDENCE_DIR, PROJECT_INTENT_DIR]) {
    const from = join(src, dir)
    if (await pathExists(from)) {
      await cp(from, activeReviewPath(repoPath, dir), { recursive: true })
    }
  }

  // Drop the archive entry after promote (it is now active).
  await rm(src, { recursive: true, force: true })
}
