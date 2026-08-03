import { boardRouter } from './router/board'
import { daemonRouter } from './router/daemon'
import { filesRouter } from './router/files'
import { gitRouter } from './router/git'
import { networkRouter } from './router/network'
import { reposRouter } from './router/repos'
import { reviewRouter } from './router/review'
import { settingsRouter } from './router/settings'
import { terminalRouter } from './router/terminal'
import { t } from './trpc'

export type { FileView } from './router/files'
export type { DirEntry, RepoInfo } from './router/repos'

/**
 * The daemon's whole tRPC surface. `mergeRouters` merges the domain routers at ONE
 * level — every procedure keeps the flat name its clients call (`gitStatus`, not
 * `git.status`), so the split is a source-layout change and never a wire change.
 */
export const router = t.mergeRouters(
  daemonRouter,
  reposRouter,
  gitRouter,
  filesRouter,
  reviewRouter,
  boardRouter,
  settingsRouter,
  networkRouter,
  terminalRouter,
)

export type AppRouter = typeof router
