import { readFileSync, realpathSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
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
 * Review template metadata is read from the daemon-root Canvas bundle. Legacy
 * repo-local review files are consumed only by the one-time migration reader;
 * they are deliberately not part of the live daemon surface.
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

/** Find the daemon-root Project identity the CLI used for this checkout. */
function projectIdentity(repoPath: string): { projectId: string } | null {
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
      (entry): entry is { id: string; commonGitDir: string } =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        (entry as { commonGitDir?: unknown }).commonGitDir === commonGitDir,
    )
    return project === undefined ? null : { projectId: project.id }
  } catch {
    return null
  }
}

/** Read the Review template metadata carried by the Project-owned Canvas. */
async function readCanvasReviewSet(repoPath: string): Promise<ReviewSet | null> {
  const identity = projectIdentity(repoPath)
  if (identity === null) return null
  try {
    const index = JSON.parse(
      await readFile(canvasIndexPath(porcelainHome(), identity.projectId), 'utf8'),
    ) as {
      value?: { canvases?: unknown[] }
    }
    const candidates = (index.value?.canvases ?? []).filter(
      (entry): entry is { id: string; template?: string; updatedAt?: string } =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string',
    )
    const record = candidates
      .filter((entry) => entry.template === 'review')
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0]
    if (record === undefined) return null
    const raw = JSON.parse(
      await readFile(
        join(canvasBundleDir(porcelainHome(), identity.projectId, record.id), 'review.json'),
        'utf8',
      ),
    )
    const parsed = reviewSetSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** The Review Canvas template metadata, or null when no template is present. */
export async function readReviewSet(repoPath: string): Promise<ReviewSet | null> {
  const canvas = await readCanvasReviewSet(repoPath)
  if (canvas !== null) return sanitizeReview(repoPath, lenientReviewSetSchema.parse(canvas))
  return null
}
