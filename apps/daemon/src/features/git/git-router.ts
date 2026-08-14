import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { toTrpcError } from '../../daemon-composition/public-error'
import { publicProcedure, t } from '../../trpc'
import type { GitOperations } from './git-operations'
import type { GitProjectResult, GitWorkspaceResult } from './git-ports'

function throwIfWorkspaceFailed<T>(result: GitWorkspaceResult<T>): T {
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

function throwIfProjectReadFailed<T>(result: GitProjectResult<T>): T {
  if (result.ok) return result.value
  if (result.error.code === 'git.not-a-repository') {
    throw toTrpcError(expectedFailure('git.not-a-repository'))
  }
  const _exhaustive: never = result.error.code
  throw _exhaustive
}

export function createGitFeatureRouter(operations: GitOperations) {
  return t.router({
    gitCheckout: publicProcedure
      .input(procedureCatalog.gitCheckout.input)
      .output(procedureCatalog.gitCheckout.output)
      .mutation(async ({ input }) => throwIfWorkspaceFailed(await operations.checkoutGit(input))),

    gitAddWorktree: publicProcedure
      .input(procedureCatalog.gitAddWorktree.input)
      .output(procedureCatalog.gitAddWorktree.output)
      .mutation(async ({ input }) =>
        throwIfWorkspaceFailed(await operations.addGitWorktree(input)),
      ),

    gitQuickCommand: publicProcedure
      .input(procedureCatalog.gitQuickCommand.input)
      .output(procedureCatalog.gitQuickCommand.output)
      .mutation(({ input }) => operations.quickCommandGit(input)),

    gitPush: publicProcedure
      .input(procedureCatalog.gitPush.input)
      .output(procedureCatalog.gitPush.output)
      .mutation(({ input }) => operations.pushGit(input)),

    gitStageAll: publicProcedure
      .input(procedureCatalog.gitStageAll.input)
      .output(procedureCatalog.gitStageAll.output)
      .mutation(async ({ input }) => {
        await operations.stageAllGit(input)
      }),

    gitUnstageAll: publicProcedure
      .input(procedureCatalog.gitUnstageAll.input)
      .output(procedureCatalog.gitUnstageAll.output)
      .mutation(async ({ input }) => {
        await operations.unstageAllGit(input)
      }),

    gitStageFile: publicProcedure
      .input(procedureCatalog.gitStageFile.input)
      .output(procedureCatalog.gitStageFile.output)
      .mutation(async ({ input }) => {
        await operations.stageFileGit(input)
      }),

    gitUnstageFile: publicProcedure
      .input(procedureCatalog.gitUnstageFile.input)
      .output(procedureCatalog.gitUnstageFile.output)
      .mutation(async ({ input }) => {
        await operations.unstageFileGit(input)
      }),

    gitDiscardFile: publicProcedure
      .input(procedureCatalog.gitDiscardFile.input)
      .output(procedureCatalog.gitDiscardFile.output)
      .mutation(async ({ input }) => {
        await operations.discardFileGit(input)
      }),

    gitCommit: publicProcedure
      .input(procedureCatalog.gitCommit.input)
      .output(procedureCatalog.gitCommit.output)
      .mutation(async ({ input }) => {
        await operations.commitGit(input)
      }),

    gitGenerateCommitMessage: publicProcedure
      .input(procedureCatalog.gitGenerateCommitMessage.input)
      .output(procedureCatalog.gitGenerateCommitMessage.output)
      .mutation(async ({ input }) => ({
        message: await operations.generateCommitMessageGit(input),
      })),

    gitGenerateCommitGroups: publicProcedure
      .input(procedureCatalog.gitGenerateCommitGroups.input)
      .output(procedureCatalog.gitGenerateCommitGroups.output)
      .mutation(async ({ input }) => ({
        groups: await operations.generateCommitGroupsGit(input),
      })),

    gitCommitConventions: publicProcedure
      .input(procedureCatalog.gitCommitConventions.input)
      .output(procedureCatalog.gitCommitConventions.output)
      .query(({ input }) => operations.commitConventionsGit(input)),

    gitStatus: publicProcedure
      .input(procedureCatalog.gitStatus.input)
      .output(procedureCatalog.gitStatus.output)
      .query(async ({ input }) => throwIfProjectReadFailed(await operations.statusGit(input))),

    gitSuggestions: publicProcedure
      .input(procedureCatalog.gitSuggestions.input)
      .output(procedureCatalog.gitSuggestions.output)
      .query(({ input }) => operations.suggestionsGit(input)),

    gitHead: publicProcedure
      .input(procedureCatalog.gitHead.input)
      .output(procedureCatalog.gitHead.output)
      .query(({ input }) => operations.headGit(input)),

    gitBranches: publicProcedure
      .input(procedureCatalog.gitBranches.input)
      .output(procedureCatalog.gitBranches.output)
      .query(async ({ input }) => throwIfProjectReadFailed(await operations.branchesGit(input))),

    gitCreateBranch: publicProcedure
      .input(procedureCatalog.gitCreateBranch.input)
      .output(procedureCatalog.gitCreateBranch.output)
      .mutation(({ input }) => operations.createBranchGit(input)),

    gitWorktrees: publicProcedure
      .input(procedureCatalog.gitWorktrees.input)
      .output(procedureCatalog.gitWorktrees.output)
      .query(async ({ input }) => throwIfProjectReadFailed(await operations.worktreesGit(input))),

    gitFlow: publicProcedure
      .input(procedureCatalog.gitFlow.input)
      .output(procedureCatalog.gitFlow.output)
      .query(({ input }) => operations.flowGit(input)),

    gitRangeFlow: publicProcedure
      .input(procedureCatalog.gitRangeFlow.input)
      .output(procedureCatalog.gitRangeFlow.output)
      .query(({ input }) => operations.rangeFlowGit(input)),

    gitRangeDiffFile: publicProcedure
      .input(procedureCatalog.gitRangeDiffFile.input)
      .output(procedureCatalog.gitRangeDiffFile.output)
      .query(({ input }) => operations.rangeDiffFileGit(input)),

    gitDiffFile: publicProcedure
      .input(procedureCatalog.gitDiffFile.input)
      .output(procedureCatalog.gitDiffFile.output)
      .query(({ input }) => operations.diffFileGit(input)),

    gitLog: publicProcedure
      .input(procedureCatalog.gitLog.input)
      .output(procedureCatalog.gitLog.output)
      .query(({ input }) => operations.logGit(input)),

    gitCommitMessage: publicProcedure
      .input(procedureCatalog.gitCommitMessage.input)
      .output(procedureCatalog.gitCommitMessage.output)
      .query(({ input }) => operations.commitMessageGit(input)),

    gitFileLog: publicProcedure
      .input(procedureCatalog.gitFileLog.input)
      .output(procedureCatalog.gitFileLog.output)
      .query(({ input }) => operations.fileLogGit(input)),

    gitCommitDiff: publicProcedure
      .input(procedureCatalog.gitCommitDiff.input)
      .output(procedureCatalog.gitCommitDiff.output)
      .query(({ input }) => operations.commitDiffGit(input)),

    gitCommitFlow: publicProcedure
      .input(procedureCatalog.gitCommitFlow.input)
      .output(procedureCatalog.gitCommitFlow.output)
      .query(({ input }) => operations.commitFlowGit(input)),

    diffReading: publicProcedure
      .input(procedureCatalog.diffReading.input)
      .output(procedureCatalog.diffReading.output)
      .query(({ input }) => operations.diffReadingGit(input)),

    commitModels: publicProcedure
      .input(procedureCatalog.commitModels.input)
      .output(procedureCatalog.commitModels.output)
      .query(() => operations.commitModelsGit()),
  })
}
