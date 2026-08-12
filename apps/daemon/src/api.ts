import type { createDaemonRouter } from './daemon-composition/create-daemon-router'

export type { DirEntry, FileView } from '@porcelain/contracts/files'
/**
 * The daemon's whole tRPC surface is built by the composition root. Callers
 * construct it once at process start (see `server.ts`); there is no process-global
 * router singleton. `mergeRouters` keeps every procedure at ONE level — every
 * procedure keeps the flat name its clients call (`gitStatus`, not `git.status`).
 */
export { createDaemonRouter } from './daemon-composition/create-daemon-router'
export {
  type CreateDaemonRouterOptions,
  createDaemonOperations,
  type DaemonOperations,
} from './daemon-composition/daemon-operations'

export type AppRouter = ReturnType<typeof createDaemonRouter>
