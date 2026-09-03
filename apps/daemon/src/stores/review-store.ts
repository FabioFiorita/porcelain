import { readFileSync, realpathSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { reviewCanvasDocumentSchema } from '@porcelain/contracts/projects'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { porcelainHome } from '@shared/porcelain-home'
import { z } from 'zod'
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
 * Review template metadata is read from the daemon-root Canvas bundle.
 */

const lenientReviewSetSchema = reviewSetSchema.extend({
  sections: z.array(z.unknown()).default([]),
})

const MAX_SECTIONS = 30

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

/** Find the daemon-root Project and Worktree identities for this checkout. */
function projectIdentity(repoPath: string): { projectId: string; worktreeId: string } | null {
  try {
    const dotGit = resolve(repoPath, '.git')
    const dotGitStat = statSync(dotGit)
    const gitDir = dotGitStat.isFile()
      ? resolve(
          repoPath,
          readFileSync(dotGit, 'utf8')
            .trim()
            .replace(/^gitdir:\s*/i, ''),
        )
      : dotGit
    const commonDirFile = resolve(gitDir, 'commondir')
    const commonDir = (() => {
      try {
        return resolve(gitDir, readFileSync(commonDirFile, 'utf8').trim())
      } catch {
        return gitDir
      }
    })()
    const commonGitDir = realpathSync(commonDir)
    const inventory = JSON.parse(
      readFileSync(join(porcelainHome(), 'hub-inventory.json'), 'utf8'),
    ) as { value?: { projects?: unknown[] } }
    const projects = inventory.value?.projects ?? []
    const project = projects.find(
      (
        entry,
      ): entry is {
        id: string
        commonGitDir: string
        worktrees?: { id: string; gitDir: string }[]
      } =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        (entry as { commonGitDir?: unknown }).commonGitDir === commonGitDir,
    )
    if (project === undefined) return null
    const worktree = project.worktrees?.find((entry) => {
      try {
        return realpathSync(entry.gitDir) === realpathSync(gitDir)
      } catch {
        return false
      }
    })
    return worktree === undefined ? null : { projectId: project.id, worktreeId: worktree.id }
  } catch {
    return null
  }
}

interface ReviewCanvasRecord {
  id: string
  worktreeId?: string | null
  template?: string
  updatedAt?: string
}

async function readReviewCandidate(
  projectId: string,
  record: ReviewCanvasRecord,
): Promise<ReviewSet | null> {
  try {
    const bundleDir = canvasBundleDir(porcelainHome(), projectId, record.id)
    const [rawMetadata, rawDocument] = await Promise.all([
      readFile(join(bundleDir, 'review.json'), 'utf8'),
      readFile(join(bundleDir, 'canvas.json'), 'utf8'),
    ])
    const metadata = reviewSetSchema.safeParse(JSON.parse(rawMetadata))
    const document = reviewCanvasDocumentSchema.safeParse(JSON.parse(rawDocument))
    if (!metadata.success || !document.success) return null

    // `review.json` is only Changes/History metadata now. Old bundles may still contain their
    // walkthrough there; prefer it as a one-way migration, otherwise project the canonical
    // semantic Canvas document into the existing Changes reading seam.
    const migratedSections = metadata.data.sections
    const sections =
      migratedSections.length > 0
        ? migratedSections
        : document.data.sections.map((section) => ({
            title: section.title,
            prose: section.prose,
            ...(section.svg === undefined ? {} : { diagram: section.svg }),
            ...(section.html === undefined ? {} : { html: section.html }),
            ...(section.htmlHeight === undefined ? {} : { htmlHeight: section.htmlHeight }),
            anchors: section.references.map((reference) => ({
              path: reference.path,
              ...(reference.startLine === undefined ? {} : { startLine: reference.startLine }),
              ...(reference.endLine === undefined ? {} : { endLine: reference.endLine }),
            })),
          }))
    return {
      ...metadata.data,
      ...(metadata.data.thesis === undefined && document.data.summary !== undefined
        ? { thesis: document.data.summary }
        : {}),
      sections,
    }
  } catch {
    return null
  }
}

/** Read Review metadata for the live Worktree, or for one immutable History commit. */
async function readCanvasReviewSet(
  repoPath: string,
  commitHash?: string,
): Promise<ReviewSet | null> {
  const identity = projectIdentity(repoPath)
  if (identity === null) return null
  try {
    const index = JSON.parse(
      await readFile(canvasIndexPath(porcelainHome(), identity.projectId), 'utf8'),
    ) as {
      value?: { canvases?: unknown[] }
    }
    const candidates = (index.value?.canvases ?? []).filter(
      (entry): entry is ReviewCanvasRecord =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string',
    )
    const reviews = candidates
      .filter((entry) => entry.template === 'review')
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    if (commitHash !== undefined) {
      for (const record of reviews) {
        const review = await readReviewCandidate(identity.projectId, record)
        if (
          review?.commitHash !== undefined &&
          (review.commitHash === commitHash || review.commitHash.startsWith(commitHash))
        ) {
          return review
        }
      }
      return null
    }
    const exact = reviews.filter((entry) => entry.worktreeId === identity.worktreeId)
    const record = (
      exact.length === 0 ? reviews.filter((entry) => entry.worktreeId == null) : exact
    )[0]
    if (record === undefined) return null
    return readReviewCandidate(identity.projectId, record)
  } catch {
    return null
  }
}

/** The Review Canvas template metadata, or null when no template is present. */
export async function readReviewSet(
  repoPath: string,
  commitHash?: string,
): Promise<ReviewSet | null> {
  const canvas = await readCanvasReviewSet(repoPath, commitHash)
  if (canvas !== null) return sanitizeReview(repoPath, lenientReviewSetSchema.parse(canvas))
  return null
}

/** Review-owned Changes presentation: declared layer order and attention-first file order. */
export async function reviewFlowForRepo(
  repoPath: string,
  commitHash?: string,
): Promise<{
  layers: readonly { label: string; pattern: string }[]
  orderedPaths: readonly string[]
}> {
  const review = await readReviewSet(repoPath, commitHash)
  return {
    layers: review?.layers ?? [],
    orderedPaths: review?.files.map((file) => file.path) ?? [],
  }
}
