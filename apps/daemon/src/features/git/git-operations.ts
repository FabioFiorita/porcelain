import { join } from 'node:path'
import type { CommitModelOption } from '@porcelain/contracts'
import type {
  BranchRef,
  ChangedFile,
  Commit,
  CommitConventions,
  DiffFileResult,
  DiffReadingInput,
  DiffReadingOutput,
  GitAddWorktreeInput,
  GitApplyCommitGroupsInput,
  GitApplyCommitGroupsOutput,
  GitCheckoutInput,
  GitCommitDiffInput,
  GitCommitFlowInput,
  GitCommitInput,
  GitCommitMessageInput,
  GitCreateBranchInput,
  GitDiffFileInput,
  GitDiscardFileInput,
  GitFileLogInput,
  GitGenerateCommitGroupsInput,
  GitGenerateCommitGroupsOutput,
  GitGenerateCommitMessageInput,
  GitHead,
  GitLogInput,
  GitPushInput,
  GitQuickCommandInput,
  GitRangeDiffFileInput,
  GitRangeFlowInput,
  GitStageAllInput,
  GitStageFileInput,
  GitSuggestion,
  GitUnstageAllInput,
  GitUnstageFileInput,
  Worktree,
} from '@porcelain/contracts/git'
import { parseConventions } from '../../git/conventions'
import type { DiffHunk } from '../../git/diff'
import { buildDiffReading } from '../../review/active-review'
import type { FlowGroup } from '../../review/flow'
import type {
  CommitGeneration,
  GitChanges,
  GitDiffReadingSources,
  GitProjectResult,
  GitWorkspacePort,
  GitWorkspaceResult,
  ProjectGit,
  WorkingTreeCache,
  WorkspaceTrash,
} from './git-ports'

const QUICK_COMMANDS_WITH_GIT_EFFECT = new Set<GitQuickCommandInput['command']>([
  'fetch',
  'pull',
  'push',
  'stash',
  'stash-pop',
])

export type GitOperations = Readonly<{
  checkoutGit(input: GitCheckoutInput): Promise<GitWorkspaceResult<void>>
  addGitWorktree(input: GitAddWorktreeInput): Promise<GitWorkspaceResult<Worktree>>
  quickCommandGit(input: GitQuickCommandInput): Promise<string>
  pushGit(input: GitPushInput): Promise<string>
  stageAllGit(input: GitStageAllInput): Promise<void>
  unstageAllGit(input: GitUnstageAllInput): Promise<void>
  stageFileGit(input: GitStageFileInput): Promise<void>
  unstageFileGit(input: GitUnstageFileInput): Promise<void>
  discardFileGit(input: GitDiscardFileInput): Promise<void>
  commitGit(input: GitCommitInput): Promise<void>
  generateCommitMessageGit(input: GitGenerateCommitMessageInput): Promise<string>
  generateCommitGroupsGit(
    input: GitGenerateCommitGroupsInput,
  ): Promise<GitGenerateCommitGroupsOutput['groups']>
  applyCommitGroupsGit(input: GitApplyCommitGroupsInput): Promise<GitApplyCommitGroupsOutput>
  commitConventionsGit(repoPath: string): Promise<CommitConventions>
  statusGit(repoPath: string): Promise<GitProjectResult<ChangedFile[]>>
  suggestionsGit(repoPath: string): Promise<GitSuggestion[]>
  headGit(repoPath: string): Promise<GitHead>
  branchesGit(repoPath: string): Promise<GitProjectResult<BranchRef[]>>
  createBranchGit(input: GitCreateBranchInput): Promise<void>
  worktreesGit(repoPath: string): Promise<GitProjectResult<Worktree[]>>
  flowGit(repoPath: string): Promise<FlowGroup[]>
  rangeFlowGit(
    input: GitRangeFlowInput,
  ): Promise<{ groups: FlowGroup[]; base: string; defaultBase: string }>
  rangeDiffFileGit(input: GitRangeDiffFileInput): Promise<DiffFileResult>
  diffFileGit(input: GitDiffFileInput): Promise<DiffFileResult>
  logGit(input: GitLogInput): Promise<Commit[]>
  commitMessageGit(input: GitCommitMessageInput): Promise<string>
  fileLogGit(input: GitFileLogInput): Promise<Commit[]>
  commitDiffGit(input: GitCommitDiffInput): Promise<DiffHunk[]>
  commitFlowGit(input: GitCommitFlowInput): Promise<FlowGroup[]>
  commitModelsGit(): Promise<CommitModelOption[]>
  diffReadingGit(input: DiffReadingInput): Promise<DiffReadingOutput>
}>

export type GitOperationDependencies = Readonly<{
  workspace: GitWorkspacePort
  projectGit: ProjectGit
  commitGeneration: CommitGeneration
  workspaceTrash: WorkspaceTrash
  workingTreeCache: WorkingTreeCache
  changes: GitChanges
  diffReadingSources: GitDiffReadingSources
}>

export function createGitOperations(dependencies: GitOperationDependencies): GitOperations {
  const {
    workspace,
    projectGit,
    commitGeneration,
    workspaceTrash,
    workingTreeCache,
    changes,
    diffReadingSources,
  } = dependencies

  function changed(repoPath: string): void {
    workingTreeCache.clear(repoPath)
    changes.publishChanged(repoPath)
  }

  return Object.freeze({
    async checkoutGit(input: GitCheckoutInput): Promise<GitWorkspaceResult<void>> {
      const result = await workspace.checkout(input.repoPath, input.branch)
      if (result.ok) changed(input.repoPath)
      return result
    },
    addGitWorktree: (input: GitAddWorktreeInput) =>
      workspace.addWorktree(input.repoPath, input.branch),

    async quickCommandGit(input: GitQuickCommandInput): Promise<string> {
      const output = await projectGit.quickCommand(input)
      workingTreeCache.clear(input.repoPath)
      if (QUICK_COMMANDS_WITH_GIT_EFFECT.has(input.command)) {
        changes.publishChanged(input.repoPath)
      }
      return output
    },

    async pushGit(input: GitPushInput): Promise<string> {
      const output = await projectGit.push(input.repoPath)
      changes.publishChanged(input.repoPath)
      return output
    },

    async stageAllGit(input: GitStageAllInput): Promise<void> {
      await projectGit.stageAll(input.repoPath)
      changed(input.repoPath)
    },

    async unstageAllGit(input: GitUnstageAllInput): Promise<void> {
      await projectGit.unstageAll(input.repoPath)
      changed(input.repoPath)
    },

    async stageFileGit(input: GitStageFileInput): Promise<void> {
      await projectGit.stageFile(input.repoPath, input.path)
      changed(input.repoPath)
    },

    async unstageFileGit(input: GitUnstageFileInput): Promise<void> {
      await projectGit.unstageFile(input.repoPath, input.path)
      changed(input.repoPath)
    },

    async discardFileGit(input: GitDiscardFileInput): Promise<void> {
      if (await projectGit.fileInHead(input.repoPath, input.path)) {
        await projectGit.restoreFromHead(input.repoPath, input.path)
      } else {
        await projectGit.resetPath(input.repoPath, input.path)
        await workspaceTrash.moveToTrash(join(input.repoPath, input.path))
      }
      changed(input.repoPath)
    },

    async commitGit(input: GitCommitInput): Promise<void> {
      await projectGit.commit(input.repoPath, input.message)
      changed(input.repoPath)
    },

    generateCommitMessageGit: (input: GitGenerateCommitMessageInput) =>
      commitGeneration.generateMessage(input),

    generateCommitGroupsGit: (input: GitGenerateCommitGroupsInput) =>
      commitGeneration.generateGroups(input),

    /**
     * Apply a whole grouped-commit proposal in one call: for each group, stage exactly its
     * files and commit them, in order.
     *
     * The index is reset first. The daemon cannot assume the proposal is still the only thing
     * in the index — a stale proposal or manual staging in between would otherwise leak extra
     * files into the first group's commit, and "stage exactly these paths" is the whole promise
     * of this procedure. Reset touches the index only; the working tree is never modified here.
     *
     * The batch stops at the first failing group and reports per-group outcomes rather than
     * throwing, because groups before the failure are already committed and the human needs to
     * know which. The failed group's partial staging is reset; if that cleanup itself fails,
     * the failed result carries both errors so a partial index can never be mistaken for a clean
     * one. Every started batch publishes freshness even when cleanup fails.
     */
    async applyCommitGroupsGit(
      input: GitApplyCommitGroupsInput,
    ): Promise<GitApplyCommitGroupsOutput> {
      const { repoPath, groups } = input
      const results: GitApplyCommitGroupsOutput['results'] = []
      let mutationStarted = false
      try {
        await projectGit.unstageAll(repoPath)
        mutationStarted = true
        let failed = false
        for (const group of groups) {
          if (failed) {
            results.push({ ...group, status: 'skipped', error: null })
            continue
          }
          try {
            for (const path of group.files) await projectGit.stageFile(repoPath, path)
            await projectGit.commit(repoPath, group.message)
            results.push({ ...group, status: 'committed', error: null })
          } catch (error) {
            const failure = error instanceof Error ? error.message : String(error)
            let cleanupFailure: string | null = null
            try {
              await projectGit.unstageAll(repoPath)
            } catch (cleanupError) {
              cleanupFailure =
                cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
            }
            failed = true
            results.push({
              ...group,
              status: 'failed',
              error:
                cleanupFailure === null
                  ? failure
                  : `${failure}\nCould not restore the index: ${cleanupFailure}`,
            })
          }
        }
      } finally {
        if (mutationStarted) changed(repoPath)
      }
      return { results }
    },

    async commitConventionsGit(repoPath: string): Promise<CommitConventions> {
      const commits = await projectGit.log(repoPath, 200)
      return parseConventions(commits.map((commit) => commit.subject))
    },

    statusGit: (repoPath: string) => projectGit.status(repoPath),

    suggestionsGit: (repoPath: string) => projectGit.suggestions(repoPath),

    headGit: (repoPath: string) => projectGit.head(repoPath),

    branchesGit: (repoPath: string) => projectGit.branches(repoPath),

    async createBranchGit(input: GitCreateBranchInput): Promise<void> {
      await projectGit.createBranch(input.repoPath, input.branch)
      changed(input.repoPath)
    },

    worktreesGit: (repoPath: string) => projectGit.worktrees(repoPath),

    flowGit: (repoPath: string) => diffReadingSources.loadWorkingFlow(repoPath),

    rangeFlowGit: (input: GitRangeFlowInput) =>
      diffReadingSources.loadRangeFlow(input.repoPath, input.base),

    rangeDiffFileGit: (input: GitRangeDiffFileInput) =>
      diffReadingSources.rangeDiffFile(input.repoPath, input.base, input.filePath, input.context),

    diffFileGit: (input: GitDiffFileInput) =>
      diffReadingSources.diffFile(input.repoPath, input.filePath, input.context),

    logGit: (input: GitLogInput) => projectGit.log(input.repoPath, input.limit),

    commitMessageGit: (input: GitCommitMessageInput) =>
      diffReadingSources.commitMessage(input.repoPath, input.hash),

    fileLogGit: (input: GitFileLogInput) =>
      projectGit.fileLog(input.repoPath, input.filePath, input.limit),

    commitDiffGit: (input: GitCommitDiffInput) =>
      diffReadingSources.commitHunks(input.repoPath, input.hash, input.filePath),

    commitFlowGit: (input: GitCommitFlowInput) =>
      diffReadingSources.loadCommitFlow(input.repoPath, input.hash),

    commitModelsGit: () => commitGeneration.listModels(),

    async diffReadingGit(input: DiffReadingInput): Promise<DiffReadingOutput> {
      const { repoPath, scope, context } = input
      let groups: FlowGroup[]
      let name: string
      let fetchHunks: (path: string) => Promise<DiffHunk[]>

      if (scope.type === 'working') {
        groups = await diffReadingSources.loadWorkingFlow(repoPath)
        name = 'Changes'
        fetchHunks = (path: string) => diffReadingSources.workingHunks(repoPath, path, context)
      } else if (scope.type === 'branch') {
        const range = await diffReadingSources.loadRangeFlow(repoPath, scope.base)
        groups = range.groups
        name = `vs ${range.base}`
        fetchHunks = (path: string) =>
          diffReadingSources.rangeHunks(repoPath, range.base, path, context)
      } else {
        groups = await diffReadingSources.loadCommitFlow(repoPath, scope.hash)
        const message = await diffReadingSources.commitMessage(repoPath, scope.hash)
        name = message.split('\n')[0]?.trim() || scope.hash.slice(0, 12)
        fetchHunks = (path: string) =>
          diffReadingSources.commitHunks(repoPath, scope.hash, path, context)
      }

      const files = groups.flatMap((group) => group.files)
      const diffs = new Map<string, DiffHunk[]>()
      await Promise.all(
        files.map(async (file) => {
          try {
            diffs.set(file.path, await fetchHunks(file.path))
          } catch {
            // vanished/renamed between the flow snapshot and this read — empty hunks
          }
        }),
      )
      return buildDiffReading({ name, groups, diffs })
    },
  })
}
