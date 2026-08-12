import type { BrowseDirsOutput, ProjectInfo } from '@porcelain/contracts/projects'
import type {
  ProjectsEffects,
  ProjectsPort,
  ProjectsPortError,
  ProjectsWorktree,
} from './projects-ports'
import type { ProjectsRecentsStore } from './projects-recents-store'

export type ProjectsOperationError =
  | { readonly code: 'projects.not-found' }
  | { readonly code: 'projects.not-a-directory' }
  | { readonly code: 'projects.unavailable' }

export type ProjectOperationResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: ProjectsOperationError }

export type ProjectsOperations = Readonly<{
  openProject: (path: string) => Promise<ProjectOperationResult<ProjectInfo>>
  listRecentProjects: (input: {
    includeWorktrees: boolean
  }) => Promise<ProjectOperationResult<ProjectInfo[]>>
  removeRecentProject: (path: string) => Promise<ProjectOperationResult<void>>
  browseProjectDirectories: (
    path: string | null,
  ) => Promise<ProjectOperationResult<BrowseDirsOutput>>
}>

function failure(error: ProjectsOperationError): ProjectOperationResult<never> {
  return { ok: false, error }
}

function mapPortError(error: ProjectsPortError): ProjectsOperationError {
  switch (error) {
    case 'not-found':
      return { code: 'projects.not-found' }
    case 'not-a-directory':
      return { code: 'projects.not-a-directory' }
    case 'unavailable':
      return { code: 'projects.unavailable' }
  }
}

function mapUnavailable<Value>(result: {
  ok: false
  error: { code: 'projects.unavailable' }
}): ProjectOperationResult<Value> {
  return { ok: false, error: result.error }
}

export function createProjectsOperations(options: {
  projects: ProjectsPort
  recents: ProjectsRecentsStore
  worktree: ProjectsWorktree
  effects: ProjectsEffects
}): ProjectsOperations {
  return Object.freeze({
    async openProject(path: string): Promise<ProjectOperationResult<ProjectInfo>> {
      const inspected = await options.projects.inspectProject(path)
      if (!inspected.ok) return failure(mapPortError(inspected.error))

      const added = await options.recents.addPath(path)
      if (!added.ok) return mapUnavailable(added)

      options.effects.watchProjectCompanion(path)
      options.effects.warmFileList(path)
      return { ok: true, value: inspected.value }
    },

    async listRecentProjects(input: {
      includeWorktrees: boolean
    }): Promise<ProjectOperationResult<ProjectInfo[]>> {
      const recentPaths = await options.recents.readPaths()
      if (!recentPaths.ok) return mapUnavailable(recentPaths)

      const projects = await Promise.all(
        recentPaths.value.map(async (path): Promise<ProjectInfo | null> => {
          const inspected = await options.projects.inspectProject(path)
          if (!inspected.ok) return null
          if (!input.includeWorktrees && (await options.worktree.isLinkedWorktree(path))) {
            return null
          }
          return inspected.value
        }),
      )
      return {
        ok: true,
        value: projects.filter((project): project is ProjectInfo => project !== null),
      }
    },

    async removeRecentProject(path: string): Promise<ProjectOperationResult<void>> {
      const removed = await options.recents.removePath(path)
      if (!removed.ok) return mapUnavailable(removed)
      return { ok: true, value: undefined }
    },

    async browseProjectDirectories(
      path: string | null,
    ): Promise<ProjectOperationResult<BrowseDirsOutput>> {
      const browsed = await options.projects.browseDirectories(path)
      if (!browsed.ok) return failure(mapPortError(browsed.error))
      return { ok: true, value: browsed.value }
    },
  })
}
