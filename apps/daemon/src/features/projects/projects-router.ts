import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { toTrpcError } from '../../daemon-composition/public-error'
import { publicProcedure, t } from '../../trpc'
import type { ProjectOperationResult, ProjectsOperations } from './projects-operations'

function throwIfFailed<Value>(result: ProjectOperationResult<Value>): Value {
  if (result.ok) return result.value
  switch (result.error.code) {
    case 'projects.not-found':
      throw toTrpcError(expectedFailure('projects.not-found'))
    case 'projects.not-a-directory':
      throw toTrpcError(expectedFailure('projects.not-a-directory'))
    case 'projects.unavailable':
      throw toTrpcError(expectedFailure('projects.unavailable'))
    case 'git.not-a-repository':
      throw toTrpcError(expectedFailure('git.not-a-repository'))
    case 'git.branch-already-exists':
      throw toTrpcError(expectedFailure('git.branch-already-exists'))
    case 'git.worktree-conflict':
      throw toTrpcError(expectedFailure('git.worktree-conflict'))
  }
}

export function createProjectsRouter(operations: ProjectsOperations) {
  return t.router({
    openRepoPath: publicProcedure
      .input(procedureCatalog.openRepoPath.input)
      .output(procedureCatalog.openRepoPath.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.openProject(input))),

    recentRepos: publicProcedure
      .input(procedureCatalog.recentRepos.input)
      .output(procedureCatalog.recentRepos.output)
      .query(async ({ input }) =>
        throwIfFailed(
          await operations.listRecentProjects({
            includeWorktrees: input?.includeWorktrees ?? false,
          }),
        ),
      ),

    removeRecentRepo: publicProcedure
      .input(procedureCatalog.removeRecentRepo.input)
      .output(procedureCatalog.removeRecentRepo.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.removeRecentProject(input))),

    removeHubProject: publicProcedure
      .input(procedureCatalog.removeHubProject.input)
      .output(procedureCatalog.removeHubProject.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.removeHubProject(input))),

    removeHubWorktree: publicProcedure
      .input(procedureCatalog.removeHubWorktree.input)
      .output(procedureCatalog.removeHubWorktree.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.removeHubWorktree(input))),

    browseDirs: publicProcedure
      .input(procedureCatalog.browseDirs.input)
      .output(procedureCatalog.browseDirs.output)
      .query(async ({ input }) => throwIfFailed(await operations.browseProjectDirectories(input))),

    hubInventory: publicProcedure
      .input(procedureCatalog.hubInventory.input)
      .output(procedureCatalog.hubInventory.output)
      .query(async () => throwIfFailed(await operations.listHubInventory())),

    createHubWorktree: publicProcedure
      .input(procedureCatalog.createHubWorktree.input)
      .output(procedureCatalog.createHubWorktree.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.createHubWorktree(input))),
  })
}
