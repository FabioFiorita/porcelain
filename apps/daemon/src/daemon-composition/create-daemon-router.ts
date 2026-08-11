import { createBoardRouter } from '../features/board'
import { createFilesFeatureRouter } from '../features/files'
import { createReviewCommentRouter } from '../features/review'
import { createDaemonRouter as createDaemonHostRouter } from '../router/daemon'
import { createFilesRouter } from '../router/files'
import { createGitRouter } from '../router/git'
import { createNetworkRouter } from '../router/network'
import { createReposRouter } from '../router/repos'
import { createReviewRouter } from '../router/review'
import { createSettingsRouter } from '../router/settings'
import { createTerminalRouter } from '../router/terminal'
import { t } from '../trpc'
import type { CreateDaemonRouterOptions } from './daemon-operations'

/**
 * Single composition root for the daemon's flat tRPC surface. Constructs every
 * domain router factory in the historical merge order and merges them with the
 * one shared `initTRPC` builder so procedure names stay flat on the wire.
 *
 * Board, Review-comment, and Files host-fs procedures are bound through
 * `operations`; residual Search stays on createFilesRouter until Search migrates.
 */
export function createDaemonRouter({ operations }: CreateDaemonRouterOptions) {
  return t.mergeRouters(
    createDaemonHostRouter(),
    createReposRouter(),
    createGitRouter(),
    // Files feature eight first so flat merge position matches historical createFilesRouter slot.
    createFilesFeatureRouter(operations.files),
    createFilesRouter(), // Search only
    createReviewRouter(),
    createReviewCommentRouter(operations.reviewComments),
    createBoardRouter(operations.board),
    createSettingsRouter(),
    createNetworkRouter(),
    createTerminalRouter(),
  )
}
