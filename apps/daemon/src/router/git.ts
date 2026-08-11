import { join } from 'node:path'
import { procedureCatalog } from '@porcelain/contracts'
import { moveToTrash } from '../fs/move-to-trash'
import { generateCommitGroups, generateCommitMessage } from '../git/commit-generation'
import { type CommitConventions, parseConventions } from '../git/conventions'
import {
  gitAddWorktree,
  gitBranches,
  gitCheckout,
  gitCommit,
  gitCommitDiff,
  gitCommitFiles,
  gitCommitMessage,
  gitCreateBranch,
  gitDiffFile,
  gitFileInHead,
  gitFileLog,
  gitHead,
  gitLog,
  gitPush,
  gitQuickCommand,
  gitRangeDiffFile,
  gitResetPath,
  gitRestoreFromHead,
  gitStageAll,
  gitStageFile,
  gitStatus,
  gitSuggestions,
  gitUnstageAll,
  gitUnstageFile,
  gitWorktrees,
} from '../git/git'
import { clearWorkingTreeSnapshot } from '../git/working-tree'
import { worktreeInbox } from '../git/worktree-inbox'
import type { FlowGroup } from '../review/flow'
import { loadCommitFlow, loadRangeFlow, loadWorkingFlow } from '../review/flow-build'
import { clearReviewedPaths } from '../stores/reviewed-store'
import { publicProcedure, t } from '../trpc'

export function createGitRouter() {
  return t.router({
    gitQuickCommand: publicProcedure
      .input(procedureCatalog.gitQuickCommand.input)
      .output(procedureCatalog.gitQuickCommand.output)
      .mutation(async ({ input }) => {
        const out = await gitQuickCommand(input.repoPath, input.command, input.pullMode)
        clearWorkingTreeSnapshot(input.repoPath)
        return out
      }),

    gitPush: publicProcedure
      .input(procedureCatalog.gitPush.input)
      .output(procedureCatalog.gitPush.output)
      .mutation(async ({ input }) => {
        // Push doesn't touch the working tree, so no clearWorkingTreeSnapshot here.
        return gitPush(input.repoPath)
      }),

    gitStageAll: publicProcedure
      .input(procedureCatalog.gitStageAll.input)
      .output(procedureCatalog.gitStageAll.output)
      .mutation(async ({ input }) => {
        await gitStageAll(input.repoPath)
        clearWorkingTreeSnapshot(input.repoPath)
      }),

    gitUnstageAll: publicProcedure
      .input(procedureCatalog.gitUnstageAll.input)
      .output(procedureCatalog.gitUnstageAll.output)
      .mutation(async ({ input }) => {
        await gitUnstageAll(input.repoPath)
        clearWorkingTreeSnapshot(input.repoPath)
      }),

    gitStageFile: publicProcedure
      .input(procedureCatalog.gitStageFile.input)
      .output(procedureCatalog.gitStageFile.output)
      .mutation(async ({ input }) => {
        await gitStageFile(input.repoPath, input.path)
        clearWorkingTreeSnapshot(input.repoPath)
      }),

    gitUnstageFile: publicProcedure
      .input(procedureCatalog.gitUnstageFile.input)
      .output(procedureCatalog.gitUnstageFile.output)
      .mutation(async ({ input }) => {
        await gitUnstageFile(input.repoPath, input.path)
        clearWorkingTreeSnapshot(input.repoPath)
      }),

    // Discard a single file's changes. A tracked file reverts to its committed
    // version (staged + unstaged edits gone, deletions restored); a new file is
    // unstaged then moved to the Trash (recoverable, like the tree's Delete) since
    // it has no committed version to fall back to. `trash` (npm) replaces Electron's
    // shell.trashItem — files must be trashed on the machine that owns them, and this
    // module stays Electron-free.
    gitDiscardFile: publicProcedure
      .input(procedureCatalog.gitDiscardFile.input)
      .output(procedureCatalog.gitDiscardFile.output)
      .mutation(async ({ input }) => {
        if (await gitFileInHead(input.repoPath, input.path)) {
          await gitRestoreFromHead(input.repoPath, input.path)
        } else {
          await gitResetPath(input.repoPath, input.path)
          await moveToTrash(join(input.repoPath, input.path))
        }
        clearWorkingTreeSnapshot(input.repoPath)
      }),

    gitCommit: publicProcedure
      .input(procedureCatalog.gitCommit.input)
      .output(procedureCatalog.gitCommit.output)
      .mutation(async ({ input }) => {
        await gitCommit(input.repoPath, input.message)
        clearWorkingTreeSnapshot(input.repoPath)
        // The reviewed marks describe working-tree changes; once committed they no longer
        // apply, so clear them — a later re-edit of the same file starts unreviewed.
        const committed = await gitCommitFiles(input.repoPath, 'HEAD')
        await clearReviewedPaths(
          input.repoPath,
          committed.map((file) => file.path),
        )
      }),

    gitGenerateCommitMessage: publicProcedure
      .input(procedureCatalog.gitGenerateCommitMessage.input)
      .output(procedureCatalog.gitGenerateCommitMessage.output)
      .mutation(async ({ input }) => ({
        message: await generateCommitMessage(input.repoPath, input.model),
      })),

    gitGenerateCommitGroups: publicProcedure
      .input(procedureCatalog.gitGenerateCommitGroups.input)
      .output(procedureCatalog.gitGenerateCommitGroups.output)
      .mutation(async ({ input }) => ({
        groups: await generateCommitGroups(input.repoPath, input.model),
      })),

    gitCommitConventions: publicProcedure
      .input(procedureCatalog.gitCommitConventions.input)
      .output(procedureCatalog.gitCommitConventions.output)
      .query(async ({ input }): Promise<CommitConventions> => {
        const commits = await gitLog(input, 200)
        return parseConventions(commits.map((c) => c.subject))
      }),

    gitStatus: publicProcedure
      .input(procedureCatalog.gitStatus.input)
      .output(procedureCatalog.gitStatus.output)
      .query(({ input }) => gitStatus(input)),

    gitSuggestions: publicProcedure
      .input(procedureCatalog.gitSuggestions.input)
      .output(procedureCatalog.gitSuggestions.output)
      .query(({ input }) => gitSuggestions(input)),

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

    gitHead: publicProcedure
      .input(procedureCatalog.gitHead.input)
      .output(procedureCatalog.gitHead.output)
      .query(({ input }) => gitHead(input)),

    gitBranches: publicProcedure
      .input(procedureCatalog.gitBranches.input)
      .output(procedureCatalog.gitBranches.output)
      .query(({ input }) => gitBranches(input)),

    gitCheckout: publicProcedure
      .input(procedureCatalog.gitCheckout.input)
      .output(procedureCatalog.gitCheckout.output)
      .mutation(({ input }) => gitCheckout(input.repoPath, input.branch)),

    gitCreateBranch: publicProcedure
      .input(procedureCatalog.gitCreateBranch.input)
      .output(procedureCatalog.gitCreateBranch.output)
      .mutation(({ input }) => gitCreateBranch(input.repoPath, input.branch)),

    gitWorktrees: publicProcedure
      .input(procedureCatalog.gitWorktrees.input)
      .output(procedureCatalog.gitWorktrees.output)
      .query(({ input }) => gitWorktrees(input)),

    // The Review inbox: from this checkout, the OTHER worktrees of the family with agent
    // work awaiting review. A few git spawns per call is fine — worktree counts are small
    // and the renderer polls at 15s.
    worktreeInbox: publicProcedure
      .input(procedureCatalog.worktreeInbox.input)
      .output(procedureCatalog.worktreeInbox.output)
      .query(({ input }) => worktreeInbox(input)),

    gitAddWorktree: publicProcedure
      .input(procedureCatalog.gitAddWorktree.input)
      .output(procedureCatalog.gitAddWorktree.output)
      .mutation(async ({ input }) => {
        // Companion data is in-repo under .porcelain — linked worktrees that share
        // the same commit see the same files; no daemon-side seed/copy.
        return gitAddWorktree(input.repoPath, input.branch)
      }),

    gitLog: publicProcedure
      .input(procedureCatalog.gitLog.input)
      .output(procedureCatalog.gitLog.output)
      .query(({ input }) => gitLog(input.repoPath, input.limit)),

    gitCommitMessage: publicProcedure
      .input(procedureCatalog.gitCommitMessage.input)
      .output(procedureCatalog.gitCommitMessage.output)
      .query(({ input }) => gitCommitMessage(input.repoPath, input.hash)),

    // File timeline: the commit history of a single file (--follow across renames).
    gitFileLog: publicProcedure
      .input(procedureCatalog.gitFileLog.input)
      .output(procedureCatalog.gitFileLog.output)
      .query(({ input }) => gitFileLog(input.repoPath, input.filePath, input.limit)),

    gitCommitDiff: publicProcedure
      .input(procedureCatalog.gitCommitDiff.input)
      .output(procedureCatalog.gitCommitDiff.output)
      .query(({ input }) => gitCommitDiff(input.repoPath, input.hash, input.filePath)),

    // Flow-grouped file list for a single historical commit. Uses the same
    // buildFlow pipeline as gitFlow/gitRangeFlow; sources are read from the
    // working tree (option A — best-effort, consistent with gitRangeFlow). A
    // commit hash is immutable, so the cache never needs to bust for the same hash.
    gitCommitFlow: publicProcedure
      .input(procedureCatalog.gitCommitFlow.input)
      .output(procedureCatalog.gitCommitFlow.output)
      .query(({ input }): Promise<FlowGroup[]> => loadCommitFlow(input.repoPath, input.hash)),
  })
}
