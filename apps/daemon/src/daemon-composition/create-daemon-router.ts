import { createActionsRouter } from '../features/actions'
import { createBoardRouter } from '../features/board'
import { createFilesFeatureRouter } from '../features/files'
import { createGitFeatureRouter } from '../features/git'
import { createProjectsRouter } from '../features/projects'
import { createReviewCommentRouter } from '../features/review'
import { createSearchRouter } from '../features/search'
import { createTerminalRouter } from '../features/terminal'
import { createDaemonRouter as createDaemonHostRouter } from '../router/daemon'
import { createGitRouter } from '../router/git'
import { createNetworkRouter } from '../router/network'
import { createReposRouter } from '../router/repos'
import { createReviewRouter } from '../router/review'
import { createSettingsRouter } from '../router/settings'
import { t } from '../trpc'
import type { CreateDaemonRouterOptions } from './daemon-operations'

/**
 * Single composition root for the daemon's flat tRPC surface. Constructs every
 * domain router factory in the historical merge order and merges them with the
 * one shared `initTRPC` builder so procedure names stay flat on the wire.
 *
 * Project, Board, Review-comment, Files, and Search procedures are bound through
 * `operations`; the remaining legacy routers are composition-only until their migrations land.
 */
export function createDaemonRouter({ operations }: CreateDaemonRouterOptions) {
  return t.mergeRouters(
    createDaemonHostRouter(),
    createProjectsRouter(operations.projects),
    createReposRouter(),
    createGitFeatureRouter(operations.git),
    createGitRouter(),
    // Files feature eight first so flat merge position stays stable for the Search procedures.
    createFilesFeatureRouter(operations.files),
    createSearchRouter(operations.search),
    createReviewRouter(),
    createReviewCommentRouter(operations.reviewComments),
    createBoardRouter(operations.board),
    createActionsRouter(operations.actions),
    createSettingsRouter(),
    createNetworkRouter(),
    createTerminalRouter(operations.terminal),
  )
}
