import { createActionsRouter } from '../features/actions'
import { createBoardRouter } from '../features/board'
import { createFilesFeatureRouter } from '../features/files'
import { createGitFeatureRouter } from '../features/git'
import { createProjectDataRouter } from '../features/project-data'
import { createProjectsRouter } from '../features/projects'
import { createRemoteNetworkRouter, createRemoteRouter } from '../features/remote'
import { createReviewCommentRouter, createReviewLifecycleRouter } from '../features/review'
import { createSearchRouter } from '../features/search'
import { createTerminalRouter } from '../features/terminal'
import { createGitRouter } from '../router/git'
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
 * Project, Board, Review comment and lifecycle, Files, Search, and Project Data
 * procedures are
 * bound through `operations`; the remaining legacy routers are composition-only
 * until their migrations land.
 */
export function createDaemonRouter({ operations }: CreateDaemonRouterOptions) {
  return t.mergeRouters(
    createRemoteRouter(operations.remote),
    createProjectsRouter(operations.projects),
    createReposRouter(),
    createGitFeatureRouter(operations.git),
    createGitRouter(),
    // Files feature eight first so flat merge position stays stable for the Search procedures.
    createFilesFeatureRouter(operations.files),
    createSearchRouter(operations.search),
    createReviewRouter(),
    createReviewCommentRouter(operations.review),
    createReviewLifecycleRouter(operations.review),
    createBoardRouter(operations.board),
    createActionsRouter(operations.actions),
    createProjectDataRouter(operations.projectData),
    createSettingsRouter(),
    createRemoteNetworkRouter(operations.remote),
    createTerminalRouter(operations.terminal),
  )
}
