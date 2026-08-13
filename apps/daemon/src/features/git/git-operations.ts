import { join } from 'node:path'
import type { CommitModelOption } from '@porcelain/contracts'
import type {
  BranchRef,
  ChangedFile,
  CommitConventions,
  DiffReadingInput,
  DiffReadingOutput,
  GitAddWorktreeInput,
  GitCheckoutInput,
  GitCommitInput,
  GitCreateBranchInput,
  GitDiscardFileInput,
  GitGenerateCommitGroupsInput,
  GitGenerateCommitGroupsOutput,
  GitGenerateCommitMessageInput,
  GitHead,
  GitPushInput,
  GitQuickCommandInput,
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
  ReviewMarks,
  WorkingTreeCache,
  WorkspaceTrash,
} from './git-ports'

const QUICK_COMMANDS_WITH_WORKTREE_EFFECT = new Set<GitQuickCommandInput['command']>([
  'pull',
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
  commitConventionsGit(repoPath: string): Promise<CommitConventions>
  statusGit(repoPath: string): Promise<GitProjectResult<ChangedFile[]>>
  suggestionsGit(repoPath: string): Promise<GitSuggestion[]>
  headGit(repoPath: string): Promise<GitHead>
  branchesGit(repoPath: string): Promise<GitProjectResult<BranchRef[]>>
  createBranchGit(input: GitCreateBranchInput): Promise<void>
  worktreesGit(repoPath: string): Promise<GitProjectResult<Worktree[]>>
  commitModelsGit(): Promise<CommitModelOption[]>
  diffReadingGit(input: DiffReadingInput): Promise<DiffReadingOutput>
}>

export type GitOperationDependencies = Readonly<{
  workspace: GitWorkspacePort
  projectGit: ProjectGit
  commitGeneration: CommitGeneration
  workspaceTrash: WorkspaceTrash
  reviewMarks: ReviewMarks
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
    reviewMarks,
    workingTreeCache,
    changes,
    diffReadingSources,
  } = dependencies

  function changed(repoPath: string): void {
    workingTreeCache.clear(repoPath)
    changes.publishWorkingTreeChanged(repoPath)
  }

  return Object.freeze({
    checkoutGit: (input: GitCheckoutInput) => workspace.checkout(input.repoPath, input.branch),
    addGitWorktree: (input: GitAddWorktreeInput) =>
      workspace.addWorktree(input.repoPath, input.branch),

    async quickCommandGit(input: GitQuickCommandInput): Promise<string> {
      const output = await projectGit.quickCommand(input)
      workingTreeCache.clear(input.repoPath)
      if (QUICK_COMMANDS_WITH_WORKTREE_EFFECT.has(input.command)) {
        changes.publishWorkingTreeChanged(input.repoPath)
      }
      return output
    },

    pushGit: (input: GitPushInput) => projectGit.push(input.repoPath),

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
      workingTreeCache.clear(input.repoPath)
      const committed = await projectGit.commitFiles(input.repoPath, 'HEAD')
      await reviewMarks.clear(
        input.repoPath,
        committed.map((file) => file.path),
      )
      changes.publishWorkingTreeChanged(input.repoPath)
    },

    generateCommitMessageGit: (input: GitGenerateCommitMessageInput) =>
      commitGeneration.generateMessage(input),

    generateCommitGroupsGit: (input: GitGenerateCommitGroupsInput) =>
      commitGeneration.generateGroups(input),

    async commitConventionsGit(repoPath: string): Promise<CommitConventions> {
      const commits = await projectGit.log(repoPath, 200)
      return parseConventions(commits.map((commit) => commit.subject))
    },

    statusGit: (repoPath: string) => projectGit.status(repoPath),

    suggestionsGit: (repoPath: string) => projectGit.suggestions(repoPath),

    headGit: (repoPath: string) => projectGit.head(repoPath),

    branchesGit: (repoPath: string) => projectGit.branches(repoPath),

    createBranchGit: (input: GitCreateBranchInput) =>
      projectGit.createBranch(input.repoPath, input.branch),

    worktreesGit: (repoPath: string) => projectGit.worktrees(repoPath),

    commitModelsGit: () => commitGeneration.listModels(),

    async diffReadingGit(input: DiffReadingInput): Promise<DiffReadingOutput> {
      const { repoPath, scope } = input
      let groups: FlowGroup[]
      let name: string
      let fetchHunks: (path: string) => Promise<DiffHunk[]>

      if (scope.type === 'working') {
        groups = await diffReadingSources.loadWorkingFlow(repoPath)
        name = 'Changes'
        fetchHunks = (path: string) => diffReadingSources.workingHunks(repoPath, path)
      } else if (scope.type === 'branch') {
        const range = await diffReadingSources.loadRangeFlow(repoPath)
        groups = range.groups
        name = `vs ${range.base}`
        fetchHunks = (path: string) => diffReadingSources.rangeHunks(repoPath, range.base, path)
      } else {
        groups = await diffReadingSources.loadCommitFlow(repoPath, scope.hash)
        const message = await diffReadingSources.commitMessage(repoPath, scope.hash)
        name = message.split('\n')[0]?.trim() || scope.hash.slice(0, 12)
        fetchHunks = (path: string) => diffReadingSources.commitHunks(repoPath, scope.hash, path)
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
