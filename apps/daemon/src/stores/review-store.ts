import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { ACTIVE_FILES } from '@shared/project-porcelain'
import { z } from 'zod'
import { createProjectChannel } from '../net/project-channel'
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
 * Active review set — `<repo>/.porcelain/review.json`. CLI authors; the app reads.
 * Archiving, publishing, and restoring live in the Review lifecycle operations
 * adapter, so this module reaches neither Git nor Project Data.
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
