import { procedureCatalog } from '@porcelain/contracts'
import {
  gitCommitDiff,
  gitCommitMessage,
  gitDiffFile,
  gitFileLog,
  gitLog,
  gitRangeDiffFile,
} from '../git/git'
import { worktreeInbox } from '../git/worktree-inbox'
import type { FlowGroup } from '../review/flow'
import { loadCommitFlow, loadRangeFlow, loadWorkingFlow } from '../review/flow-build'
import { publicProcedure, t } from '../trpc'

export function createGitRouter() {
  return t.router({
    gitFlow: publicProcedure
      .input(procedureCatalog.gitFlow.input)
      .output(procedureCatalog.gitFlow.output)
      .query(({ input }): Promise<FlowGroup[]> => loadWorkingFlow(input)),

    gitRangeFlow: publicProcedure
      .input(procedureCatalog.gitRangeFlow.input)
      .output(procedureCatalog.gitRangeFlow.output)
      .query(({ input }): Promise<{ groups: FlowGroup[]; base: string }> => loadRangeFlow(input)),

    gitRangeDiffFile: publicProcedure
      .input(procedureCatalog.gitRangeDiffFile.input)
      .output(procedureCatalog.gitRangeDiffFile.output)
      .query(({ input }) => gitRangeDiffFile(input.repoPath, input.base, input.filePath)),

    gitDiffFile: publicProcedure
      .input(procedureCatalog.gitDiffFile.input)
      .output(procedureCatalog.gitDiffFile.output)
      .query(({ input }) => gitDiffFile(input.repoPath, input.filePath)),

    worktreeInbox: publicProcedure
      .input(procedureCatalog.worktreeInbox.input)
      .output(procedureCatalog.worktreeInbox.output)
      .query(({ input }) => worktreeInbox(input)),

    gitLog: publicProcedure
      .input(procedureCatalog.gitLog.input)
      .output(procedureCatalog.gitLog.output)
      .query(({ input }) => gitLog(input.repoPath, input.limit)),

    gitCommitMessage: publicProcedure
      .input(procedureCatalog.gitCommitMessage.input)
      .output(procedureCatalog.gitCommitMessage.output)
      .query(({ input }) => gitCommitMessage(input.repoPath, input.hash)),

    gitFileLog: publicProcedure
      .input(procedureCatalog.gitFileLog.input)
      .output(procedureCatalog.gitFileLog.output)
      .query(({ input }) => gitFileLog(input.repoPath, input.filePath, input.limit)),

    gitCommitDiff: publicProcedure
      .input(procedureCatalog.gitCommitDiff.input)
      .output(procedureCatalog.gitCommitDiff.output)
      .query(({ input }) => gitCommitDiff(input.repoPath, input.hash, input.filePath)),

    gitCommitFlow: publicProcedure
      .input(procedureCatalog.gitCommitFlow.input)
      .output(procedureCatalog.gitCommitFlow.output)
      .query(({ input }): Promise<FlowGroup[]> => loadCommitFlow(input.repoPath, input.hash)),
  })
}
