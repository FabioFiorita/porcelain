import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { toTrpcError } from '../../daemon-composition/public-error'
import { publicProcedure, t } from '../../trpc'
import type { GitOperations } from './git-operations'
import type { GitWorkspaceResult } from './git-ports'

function throwIfFailed<T>(result: GitWorkspaceResult<T>): T {
  if (result.ok) return result.value

  switch (result.error.code) {
    case 'git.not-a-repository':
      throw toTrpcError(expectedFailure('git.not-a-repository'))
    case 'git.branch-not-found':
      throw toTrpcError(expectedFailure('git.branch-not-found'))
    case 'git.branch-already-exists':
      throw toTrpcError(expectedFailure('git.branch-already-exists'))
    case 'git.worktree-conflict':
      throw toTrpcError(expectedFailure('git.worktree-conflict'))
    case 'git.working-tree-conflict':
      throw toTrpcError(expectedFailure('git.working-tree-conflict'))
    default: {
      const _exhaustive: never = result.error
      throw _exhaustive
    }
  }
}

export function createGitFeatureRouter(operations: GitOperations) {
  return t.router({
    gitCheckout: publicProcedure
      .input(procedureCatalog.gitCheckout.input)
      .output(procedureCatalog.gitCheckout.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.checkoutGit(input))),

    gitAddWorktree: publicProcedure
      .input(procedureCatalog.gitAddWorktree.input)
      .output(procedureCatalog.gitAddWorktree.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.addGitWorktree(input))),
  })
}
