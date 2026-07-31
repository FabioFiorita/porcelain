import { join } from 'node:path'
import trash from 'trash'
import { z } from 'zod'
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
  QUICK_COMMANDS,
} from '../git/git'
import { clearWorkingTreeSnapshot } from '../git/working-tree'
import { worktreeInbox } from '../git/worktree-inbox'
import { seedRepoSettings } from '../repo-settings'
import type { FlowGroup } from '../review/flow'
import { loadCommitFlow, loadRangeFlow, loadWorkingFlow } from '../review/flow-build'
import { clearReviewedPaths } from '../stores/reviewed-store'
import { publicProcedure, t } from '../trpc'

export const gitRouter = t.router({
  gitQuickCommand: publicProcedure
    .input(
      z.object({
        repoPath: z.string(),
        command: z.string().refine((id) => id in QUICK_COMMANDS, 'unknown command'),
        pullMode: z.enum(['merge', 'rebase']).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const out = await gitQuickCommand(input.repoPath, input.command, input.pullMode)
      clearWorkingTreeSnapshot(input.repoPath)
      return out
    }),

  gitPush: publicProcedure.input(z.object({ repoPath: z.string() })).mutation(async ({ input }) => {
    // Push doesn't touch the working tree, so no clearWorkingTreeSnapshot here.
    return gitPush(input.repoPath)
  }),

  gitStageAll: publicProcedure
    .input(z.object({ repoPath: z.string() }))
    .mutation(async ({ input }) => {
      await gitStageAll(input.repoPath)
      clearWorkingTreeSnapshot(input.repoPath)
    }),

  gitUnstageAll: publicProcedure
    .input(z.object({ repoPath: z.string() }))
    .mutation(async ({ input }) => {
      await gitUnstageAll(input.repoPath)
      clearWorkingTreeSnapshot(input.repoPath)
    }),

  gitStageFile: publicProcedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await gitStageFile(input.repoPath, input.path)
      clearWorkingTreeSnapshot(input.repoPath)
    }),

  gitUnstageFile: publicProcedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
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
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      if (await gitFileInHead(input.repoPath, input.path)) {
        await gitRestoreFromHead(input.repoPath, input.path)
      } else {
        await gitResetPath(input.repoPath, input.path)
        await trash(join(input.repoPath, input.path))
      }
      clearWorkingTreeSnapshot(input.repoPath)
    }),

  gitCommit: publicProcedure
    .input(z.object({ repoPath: z.string(), message: z.string().trim().min(1) }))
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

  gitCommitConventions: publicProcedure
    .input(z.string())
    .query(async ({ input }): Promise<CommitConventions> => {
      const commits = await gitLog(input, 200)
      return parseConventions(commits.map((c) => c.subject))
    }),

  gitStatus: publicProcedure.input(z.string()).query(({ input }) => gitStatus(input)),

  gitSuggestions: publicProcedure.input(z.string()).query(({ input }) => gitSuggestions(input)),

  gitFlow: publicProcedure
    .input(z.string())
    .query(({ input }): Promise<FlowGroup[]> => loadWorkingFlow(input)),

  gitRangeFlow: publicProcedure
    .input(z.string())
    .query(({ input }): Promise<{ groups: FlowGroup[]; base: string }> => loadRangeFlow(input)),

  gitRangeDiffFile: publicProcedure
    .input(z.object({ repoPath: z.string(), base: z.string(), filePath: z.string() }))
    .query(({ input }) => gitRangeDiffFile(input.repoPath, input.base, input.filePath)),

  gitDiffFile: publicProcedure
    .input(z.object({ repoPath: z.string(), filePath: z.string() }))
    .query(({ input }) => gitDiffFile(input.repoPath, input.filePath)),

  gitHead: publicProcedure.input(z.string()).query(({ input }) => gitHead(input)),

  gitBranches: publicProcedure.input(z.string()).query(({ input }) => gitBranches(input)),

  gitCheckout: publicProcedure
    .input(z.object({ repoPath: z.string(), branch: z.string() }))
    .mutation(({ input }) => gitCheckout(input.repoPath, input.branch)),

  gitCreateBranch: publicProcedure
    .input(z.object({ repoPath: z.string(), branch: z.string().min(1) }))
    .mutation(({ input }) => gitCreateBranch(input.repoPath, input.branch)),

  gitWorktrees: publicProcedure.input(z.string()).query(({ input }) => gitWorktrees(input)),

  // The Review inbox: from this checkout, the OTHER worktrees of the family with agent
  // work awaiting review. A few git spawns per call is fine — worktree counts are small
  // and the renderer polls at 15s.
  worktreeInbox: publicProcedure.input(z.string()).query(({ input }) => worktreeInbox(input)),

  gitAddWorktree: publicProcedure
    .input(z.object({ repoPath: z.string(), branch: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const worktree = await gitAddWorktree(input.repoPath, input.branch)
      // The new checkout is the same project under a new path key, so seed it from
      // the checkout it was created against rather than opening it blank.
      await seedRepoSettings(input.repoPath, worktree.path)
      return worktree
    }),

  gitLog: publicProcedure
    .input(z.object({ repoPath: z.string(), limit: z.number().int().max(500).default(200) }))
    .query(({ input }) => gitLog(input.repoPath, input.limit)),

  gitCommitMessage: publicProcedure
    .input(z.object({ repoPath: z.string(), hash: z.string() }))
    .query(({ input }) => gitCommitMessage(input.repoPath, input.hash)),

  // File timeline: the commit history of a single file (--follow across renames).
  gitFileLog: publicProcedure
    .input(
      z.object({
        repoPath: z.string(),
        filePath: z.string(),
        limit: z.number().int().max(200).default(50),
      }),
    )
    .query(({ input }) => gitFileLog(input.repoPath, input.filePath, input.limit)),

  gitCommitDiff: publicProcedure
    .input(z.object({ repoPath: z.string(), hash: z.string(), filePath: z.string() }))
    .query(({ input }) => gitCommitDiff(input.repoPath, input.hash, input.filePath)),

  // Flow-grouped file list for a single historical commit. Uses the same
  // buildFlow pipeline as gitFlow/gitRangeFlow; sources are read from the
  // working tree (option A — best-effort, consistent with gitRangeFlow). A
  // commit hash is immutable, so the cache never needs to bust for the same hash.
  gitCommitFlow: publicProcedure
    .input(z.object({ repoPath: z.string(), hash: z.string() }))
    .query(({ input }): Promise<FlowGroup[]> => loadCommitFlow(input.repoPath, input.hash)),
})
