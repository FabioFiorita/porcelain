import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReviewFiles } from './review-reading-capabilities'

/** The working-tree source cap the exploration walk has always carried. */
const MAX_SOURCE_BYTES = 1024 * 1024

/**
 * Bounded working-tree source reads for the exploration walk. An unreadable path
 * (outside the repo, deleted between the file list and the read) and an oversized
 * file both answer `undefined`, which the walk treats as a leaf rather than a
 * failure.
 */
export function createFsReviewSourceFiles(): ReviewFiles {
  return Object.freeze({
    readSource: async (repoPath: string, path: string) => {
      try {
        const content = await readFile(join(repoPath, path), 'utf8')
        return content.length < MAX_SOURCE_BYTES ? content : undefined
      } catch {
        return undefined
      }
    },
  })
}
