import { createActionsRouter } from '../features/actions'
import { createBoardRouter } from '../features/board'
import { createFilesFeatureRouter } from '../features/files'
import { createGitFeatureRouter } from '../features/git'
import { createProjectDataRouter } from '../features/project-data'
import { createProjectsRouter } from '../features/projects'
import { createRemoteNetworkRouter, createRemoteRouter } from '../features/remote'
import {
  createReviewCommentRouter,
  createReviewEvidenceRouter,
  createReviewLifecycleRouter,
  createReviewMarksRouter,
  createReviewReadingRouter,
} from '../features/review'
import { createSearchRouter } from '../features/search'
import { createTerminalRouter } from '../features/terminal'
import { t } from '../trpc'
import type { CreateDaemonRouterOptions } from './daemon-operations'

/**
 * Single composition root for the daemon's flat tRPC surface. Constructs every
 * domain router factory in the historical merge order and merges them with the
 * one shared `initTRPC` builder so procedure names stay flat on the wire.
 *
 * Remote, Projects, Git, Files, Search, the whole Review domain (comments,
 * lifecycle, reading, Evidence, reviewed marks), Board, Actions, Project Data,
 * and Terminal procedures are bound through `operations`; no horizontal procedure router
 * remains outside a canonical domain feature.
 */
export function createDaemonRouter({ operations }: CreateDaemonRouterOptions) {
  return t.mergeRouters(
    createRemoteRouter(operations.remote),
    createProjectsRouter(operations.projects),
    createGitFeatureRouter(operations.git),
    createFilesFeatureRouter(operations.files),
    createSearchRouter(operations.search),
    createReviewCommentRouter(operations.review),
    createReviewLifecycleRouter(operations.review),
    createReviewReadingRouter(operations.review),
    createReviewEvidenceRouter(operations.review),
    createReviewMarksRouter(operations.review),
    createBoardRouter(operations.board),
    createActionsRouter(operations.actions),
    createProjectDataRouter(operations.projectData),
    createRemoteNetworkRouter(operations.remote),
    createTerminalRouter(operations.terminal),
  )
}
