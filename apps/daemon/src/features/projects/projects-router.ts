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
    case 'projects.dev-repo-forbidden':
      throw toTrpcError(expectedFailure('projects.dev-repo-forbidden'))
    case 'projects.overlay-target-invalid':
      throw toTrpcError(expectedFailure('projects.overlay-target-invalid'))
    case 'git.not-a-repository':
      throw toTrpcError(expectedFailure('git.not-a-repository'))
    case 'git.branch-already-exists':
      throw toTrpcError(expectedFailure('git.branch-already-exists'))
    case 'git.worktree-conflict':
      throw toTrpcError(expectedFailure('git.worktree-conflict'))
    case 'git.working-tree-conflict':
      throw toTrpcError(expectedFailure('git.working-tree-conflict'))
    case 'canvas.not-found':
      throw toTrpcError(expectedFailure('canvas.not-found'))
    case 'canvas.unavailable':
      throw toTrpcError(expectedFailure('canvas.unavailable'))
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

    environmentIdentity: publicProcedure
      .input(procedureCatalog.environmentIdentity.input)
      .output(procedureCatalog.environmentIdentity.output)
      .query(async () => throwIfFailed(await operations.environmentIdentity())),

    renameEnvironment: publicProcedure
      .input(procedureCatalog.renameEnvironment.input)
      .output(procedureCatalog.renameEnvironment.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.renameEnvironment(input.name))),

    hubInventory: publicProcedure
      .input(procedureCatalog.hubInventory.input)
      .output(procedureCatalog.hubInventory.output)
      .query(async () => throwIfFailed(await operations.listHubInventory())),

    createHubWorktree: publicProcedure
      .input(procedureCatalog.createHubWorktree.input)
      .output(procedureCatalog.createHubWorktree.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.createHubWorktree(input))),

    listCanvases: publicProcedure
      .input(procedureCatalog.listCanvases.input)
      .output(procedureCatalog.listCanvases.output)
      .query(async ({ input }) => throwIfFailed(await operations.listCanvases(input))),

    readCanvas: publicProcedure
      .input(procedureCatalog.readCanvas.input)
      .output(procedureCatalog.readCanvas.output)
      .query(async ({ input }) => throwIfFailed(await operations.readCanvas(input))),

    mintCanvasAccessToken: publicProcedure
      .input(procedureCatalog.mintCanvasAccessToken.input)
      .output(procedureCatalog.mintCanvasAccessToken.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.mintCanvasAccessToken(input))),

    promoteCanvas: publicProcedure
      .input(procedureCatalog.promoteCanvas.input)
      .output(procedureCatalog.promoteCanvas.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.promoteCanvas(input))),

    promoteOverrides: publicProcedure
      .input(procedureCatalog.promoteOverrides.input)
      .output(procedureCatalog.promoteOverrides.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.promoteOverrides(input))),

    listOverlay: publicProcedure
      .input(procedureCatalog.listOverlay.input)
      .output(procedureCatalog.listOverlay.output)
      .query(async ({ input }) => throwIfFailed(await operations.listOverlay(input))),
  })
}
