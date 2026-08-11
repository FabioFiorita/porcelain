import { createBoardRouter } from '../features/board'
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
 * Board and Review-comment procedures are bound through `operations`; remaining
 * routers still construct their own dependencies until their migrations convert them.
 */
export function createDaemonRouter({ operations }: CreateDaemonRouterOptions) {
  return t.mergeRouters(
    createDaemonHostRouter(),
    createReposRouter(),
    createGitRouter(),
    createFilesRouter(),
    createReviewRouter(),
    createReviewCommentRouter(operations.reviewComments),
    createBoardRouter(operations.board),
    createSettingsRouter(),
    createNetworkRouter(),
    createTerminalRouter(),
  )
}
