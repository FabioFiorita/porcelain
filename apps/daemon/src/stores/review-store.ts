import { randomBytes } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { access, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import {
  PROJECT_EVIDENCE_DIR,
  PROJECT_FILES,
  PROJECT_INTENT_DIR,
  projectArchivedReviewDir,
  projectIntentDir,
  projectPorcelainPath,
  projectReviewsDir,
} from '@shared/project-porcelain'
import { z } from 'zod'
import { gitForceStage } from '../git/git'
import { createProjectChannel } from '../net/project-channel'
import { ensureProjectCompanion } from '../project/migrate-home'
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
  fileName: PROJECT_FILES.review,
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
  return projectPorcelainPath('', PROJECT_FILES.review)
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
  await ensureProjectCompanion(repoPath)
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
  await ensureProjectCompanion(repoPath)
  const set = await readReviewSet(repoPath)
  const hasReview = set !== null
  const evidenceDir = projectPorcelainPath(repoPath, PROJECT_EVIDENCE_DIR)
  const commentsPath = projectPorcelainPath(repoPath, PROJECT_FILES.comments)
  const reviewedPath = projectPorcelainPath(repoPath, PROJECT_FILES.reviewed)
  const intentDir = projectIntentDir(repoPath)
  const hasEvidence = await pathExists(join(evidenceDir, 'index.html'))
  const hasComments = await pathExists(commentsPath)
  const hasReviewed = await pathExists(reviewedPath)
  const hasIntent = await pathExists(intentDir)

  if (!hasReview && !hasEvidence && !hasComments && !hasReviewed && !hasIntent) return null

  const id = newArchiveId()
  const dest = projectArchivedReviewDir(repoPath, id)
  await mkdir(dest, { recursive: true })

  const meta: ArchivedReviewMeta = {
    id,
    name: set?.name ?? 'Untitled review',
    ...(set?.thesis ? { thesis: set.thesis } : {}),
    archivedAt: new Date().toISOString(),
  }
  await writeFile(join(dest, 'meta.json'), JSON.stringify(meta, null, 2))

  if (hasReview) {
    await cp(reviewPath(repoPath), join(dest, PROJECT_FILES.review)).catch(() => {})
  }
  if (hasComments) {
    await cp(commentsPath, join(dest, PROJECT_FILES.comments)).catch(() => {})
  }
  if (hasReviewed) {
    await cp(reviewedPath, join(dest, PROJECT_FILES.reviewed)).catch(() => {})
  }
  if (hasEvidence) {
    await cp(evidenceDir, join(dest, PROJECT_EVIDENCE_DIR), { recursive: true }).catch(() => {})
  }
  if (hasIntent) {
    await cp(intentDir, join(dest, PROJECT_INTENT_DIR), { recursive: true }).catch(() => {})
  }

  await dropActiveReviewFiles(repoPath)
  return id
}

async function dropActiveReviewFiles(repoPath: string): Promise<void> {
  await rm(reviewPath(repoPath), { force: true }).catch(() => {})
  await rm(projectPorcelainPath(repoPath, PROJECT_FILES.comments), { force: true }).catch(() => {})
  await rm(projectPorcelainPath(repoPath, PROJECT_FILES.reviewed), { force: true }).catch(() => {})
  await rm(projectPorcelainPath(repoPath, PROJECT_EVIDENCE_DIR), {
    recursive: true,
    force: true,
  }).catch(() => {})
  await rm(projectIntentDir(repoPath), { recursive: true, force: true }).catch(() => {})
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
  await ensureProjectCompanion(repoPath)
  const parts = await Promise.all([
    dirCost(projectPorcelainPath(repoPath, PROJECT_EVIDENCE_DIR)),
    dirCost(projectIntentDir(repoPath)),
  ])
  let bytes = parts.reduce((sum, part) => sum + part.bytes, 0)
  let files = parts.reduce((sum, part) => sum + part.files, 0)
  for (const file of [
    reviewPath(repoPath),
    projectPorcelainPath(repoPath, PROJECT_FILES.comments),
    projectPorcelainPath(repoPath, PROJECT_FILES.reviewed),
  ]) {
    try {
      bytes += (await stat(file)).size
      files += 1
    } catch {
      // absent slot — nothing to publish from it
    }
  }
  return { bytes, files }
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
  await gitForceStage(repoPath, relative(repoPath, projectArchivedReviewDir(repoPath, id)))
  return { id, cost }
}

/** List archived reviews, newest first. */
export async function listArchivedReviews(repoPath: string): Promise<ArchivedReviewMeta[]> {
  await ensureProjectCompanion(repoPath)
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
 */
export async function restoreArchivedReview(repoPath: string, id: string): Promise<void> {
  if (id.includes('/') || id.includes('..') || id === '') {
    throw new Error('invalid review id')
  }
  const src = projectArchivedReviewDir(repoPath, id)
  if (!(await pathExists(src))) throw new Error(`archived review not found: ${id}`)

  await archiveActiveReview(repoPath)

  const reviewSrc = join(src, PROJECT_FILES.review)
  if (await pathExists(reviewSrc)) {
    await cp(reviewSrc, reviewPath(repoPath))
  }
  const commentsSrc = join(src, PROJECT_FILES.comments)
  if (await pathExists(commentsSrc)) {
    await cp(commentsSrc, projectPorcelainPath(repoPath, PROJECT_FILES.comments))
  }
  const reviewedSrc = join(src, PROJECT_FILES.reviewed)
  if (await pathExists(reviewedSrc)) {
    await cp(reviewedSrc, projectPorcelainPath(repoPath, PROJECT_FILES.reviewed))
  }
  const evidenceSrc = join(src, PROJECT_EVIDENCE_DIR)
  if (await pathExists(evidenceSrc)) {
    await cp(evidenceSrc, projectPorcelainPath(repoPath, PROJECT_EVIDENCE_DIR), {
      recursive: true,
    })
  }

  // Drop the archive entry after promote (it is now active).
  await rm(src, { recursive: true, force: true })
}
