import type { SessionChange } from '@porcelain/contracts/session'
import { type BoardOperations, createBoardOperations } from '../features/board'
import { createFilesOperations, type FilesOperations } from '../features/files'
import { createReviewCommentOperations, type ReviewCommentOperations } from '../features/review'
import { publishSessionChange } from '../session/live-session'

/**
 * Process-wide bound operation catalog constructed once at daemon startup.
 * Each domain migration adds a required non-optional property and converts its
 * router factory to receive that narrow slice in the same change.
 */
export type DaemonOperations = Readonly<{
  board: BoardOperations
  reviewComments: ReviewCommentOperations
  files: FilesOperations
}>

export interface CreateDaemonRouterOptions {
  operations: DaemonOperations
}

export function createDaemonOperations(options?: {
  publishSessionChange?: (change: SessionChange) => void
}): DaemonOperations {
  const publish = options?.publishSessionChange ?? publishSessionChange
  return Object.freeze({
    board: createBoardOperations({
      publishSessionChange: publish,
    }),
    reviewComments: createReviewCommentOperations({
      publishSessionChange: publish,
    }),
    files: createFilesOperations({ publishSessionChange: publish }),
  })
}
