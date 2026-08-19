import type { CommitModelOption } from '@porcelain/contracts'
import type {
  BranchRef,
  ChangedFile,
  Commit,
  DiffFileResult,
  GitGenerateCommitGroupsInput,
  GitGenerateCommitGroupsOutput,
  GitGenerateCommitMessageInput,
  GitHead,
  GitQuickCommandInput,
  GitSuggestion,
  Worktree,
} from '@porcelain/contracts/git'
import type { DiffHunk } from '../../git/diff'
import type { FlowGroup } from '../../review/flow'

export type GitWorkspaceError =
  | { code: 'git.not-a-repository' }
  | { code: 'git.branch-not-found' }
  | { code: 'git.branch-already-exists' }
  | { code: 'git.worktree-conflict' }
  | { code: 'git.working-tree-conflict' }

export type GitWorkspaceResult<Value> =
  | { ok: true; value: Value }
  | { ok: false; error: GitWorkspaceError }

export type GitWorkspacePort = Readonly<{
  checkout(repoPath: string, branch: string): Promise<GitWorkspaceResult<void>>
  addWorktree(
    repoPath: string,
    branch: string,
    baseRef?: string,
    existing?: boolean,
  ): Promise<GitWorkspaceResult<Worktree>>
  removeWorktree(repoPath: string, worktreePath: string): Promise<GitWorkspaceResult<void>>
}>

export type GitProjectError = Readonly<{ code: 'git.not-a-repository' }>

export type GitProjectResult<Value> =
  | { ok: true; value: Value }
  | { ok: false; error: GitProjectError }

/** Fixed Git effects used by the Git operations; arbitrary argv never crosses this port. */
export type ProjectGit = Readonly<{
  quickCommand(input: GitQuickCommandInput): Promise<string>
  push(repoPath: string): Promise<string>
  stageAll(repoPath: string): Promise<void>
  unstageAll(repoPath: string): Promise<void>
  stageFile(repoPath: string, path: string): Promise<void>
  unstageFile(repoPath: string, path: string): Promise<void>
  fileInHead(repoPath: string, path: string): Promise<boolean>
  restoreFromHead(repoPath: string, path: string): Promise<void>
  resetPath(repoPath: string, path: string): Promise<void>
  commit(repoPath: string, message: string): Promise<void>
  commitFiles(repoPath: string, hash: string): Promise<ChangedFile[]>
  status(repoPath: string): Promise<GitProjectResult<ChangedFile[]>>
  suggestions(repoPath: string): Promise<GitSuggestion[]>
  head(repoPath: string): Promise<GitHead>
  branches(repoPath: string): Promise<GitProjectResult<BranchRef[]>>
  createBranch(repoPath: string, branch: string): Promise<void>
  worktrees(repoPath: string): Promise<GitProjectResult<Worktree[]>>
  log(repoPath: string, limit: number): Promise<Commit[]>
  fileLog(repoPath: string, filePath: string, limit: number): Promise<Commit[]>
}>

export type CommitGeneration = Readonly<{
  generateMessage(input: GitGenerateCommitMessageInput): Promise<string>
  generateGroups(
    input: GitGenerateCommitGroupsInput,
  ): Promise<GitGenerateCommitGroupsOutput['groups']>
  listModels(): Promise<CommitModelOption[]>
}>

/** Flow loaders + per-file hunk helpers for continuous stacked-diff reading. */
export type GitDiffReadingSources = Readonly<{
  loadWorkingFlow(repoPath: string): Promise<FlowGroup[]>
  loadRangeFlow(repoPath: string): Promise<{ groups: FlowGroup[]; base: string }>
  loadCommitFlow(repoPath: string, hash: string): Promise<FlowGroup[]>
  workingHunks(repoPath: string, path: string): Promise<DiffHunk[]>
  rangeHunks(repoPath: string, base: string, path: string): Promise<DiffHunk[]>
  diffFile(repoPath: string, path: string, context?: number): Promise<DiffFileResult>
  rangeDiffFile(
    repoPath: string,
    base: string,
    path: string,
    context?: number,
  ): Promise<DiffFileResult>
  commitHunks(repoPath: string, hash: string, path: string): Promise<DiffHunk[]>
  commitMessage(repoPath: string, hash: string): Promise<string>
}>

export type WorkspaceTrash = Readonly<{
  moveToTrash(path: string): Promise<void>
}>

export type WorkingTreeCache = Readonly<{
  clear(repoPath: string): void
}>

export type GitChanges = Readonly<{
  publishWorkingTreeChanged(projectPath: string): void
}>
