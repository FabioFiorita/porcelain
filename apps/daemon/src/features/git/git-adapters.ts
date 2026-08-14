import type {
  BranchRef,
  Commit,
  GitGenerateCommitGroupsInput,
  GitGenerateCommitGroupsOutput,
  GitGenerateCommitMessageInput,
  GitHead,
  GitQuickCommandInput,
  GitSuggestion,
  Worktree,
} from '@porcelain/contracts/git'
import type { SessionChange } from '@porcelain/contracts/session'
import { moveToTrash } from '../../fs/move-to-trash'
import {
  generateCommitGroups,
  generateCommitMessage,
  listCommitModels,
} from '../../git/commit-generation'
import {
  gitBranches,
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
} from '../../git/git'
import { clearWorkingTreeSnapshot } from '../../git/working-tree'
import { loadCommitFlow, loadRangeFlow, loadWorkingFlow } from '../../review/flow-build'
import { clearReviewedPaths } from '../../stores/reviewed-store'
import type {
  CommitGeneration,
  GitChanges,
  GitDiffReadingSources,
  GitProjectResult,
  ProjectGit,
  ReviewMarks,
  WorkingTreeCache,
  WorkspaceTrash,
} from './git-ports'

/**
 * The text a thrown Git error actually carries.
 *
 * Exported for its own test: every branch here decides whether a failure is classified as
 * `git.not-a-repository` or rethrown, and mutation testing found the whole function unproven —
 * `if (error !== null && typeof error === 'object')` could be replaced with `if (false)` and
 * nothing failed.
 */
export function nativeOutput(error: unknown): string {
  if (error !== null && typeof error === 'object') {
    const parts: string[] = []
    if ('stderr' in error && typeof error.stderr === 'string') parts.push(error.stderr)
    if ('stdout' in error && typeof error.stdout === 'string') parts.push(error.stdout)
    if (parts.length > 0) return parts.join('\n')
  }
  return String(error)
}

/** Whether a thrown Git error is the "this path is not a repository" failure. */
export function isNotARepository(error: unknown): boolean {
  return nativeOutput(error).toLowerCase().includes('not a git repository')
}

/**
 * Run a read, converting only the "not a repository" failure into a typed result.
 *
 * Exported for its own test: without one, `if (!isNotARepository(error)) throw error` could be
 * replaced with `if (false)` and nothing failed — every Git error would silently become
 * `git.not-a-repository`, hiding permission and corruption failures behind a wrong diagnosis.
 */
export async function repositoryRead<Value>(
  read: () => Promise<Value>,
): Promise<GitProjectResult<Value>> {
  try {
    return { ok: true, value: await read() }
  } catch (error) {
    if (!isNotARepository(error)) throw error
    return { ok: false, error: { code: 'git.not-a-repository' } }
  }
}

export function createProjectGit(): ProjectGit {
  return Object.freeze({
    quickCommand: (input: GitQuickCommandInput) =>
      gitQuickCommand(input.repoPath, input.command, input.pullMode),
    push: (repoPath: string) => gitPush(repoPath),
    stageAll: (repoPath: string) => gitStageAll(repoPath),
    unstageAll: (repoPath: string) => gitUnstageAll(repoPath),
    stageFile: (repoPath: string, path: string) => gitStageFile(repoPath, path),
    unstageFile: (repoPath: string, path: string) => gitUnstageFile(repoPath, path),
    fileInHead: (repoPath: string, path: string) => gitFileInHead(repoPath, path),
    restoreFromHead: (repoPath: string, path: string) => gitRestoreFromHead(repoPath, path),
    resetPath: (repoPath: string, path: string) => gitResetPath(repoPath, path),
    commit: (repoPath: string, message: string) => gitCommit(repoPath, message),
    commitFiles: (repoPath: string, hash: string) => gitCommitFiles(repoPath, hash),
    status: (repoPath: string) => repositoryRead(() => gitStatus(repoPath)),
    suggestions: (repoPath: string): Promise<GitSuggestion[]> => gitSuggestions(repoPath),
    head: (repoPath: string): Promise<GitHead> => gitHead(repoPath),
    branches: (repoPath: string): Promise<GitProjectResult<BranchRef[]>> =>
      repositoryRead(() => gitBranches(repoPath)),
    createBranch: (repoPath: string, branch: string) => gitCreateBranch(repoPath, branch),
    worktrees: (repoPath: string): Promise<GitProjectResult<Worktree[]>> =>
      repositoryRead(() => gitWorktrees(repoPath)),
    log: (repoPath: string, limit: number): Promise<Commit[]> => gitLog(repoPath, limit),
    fileLog: (repoPath: string, filePath: string, limit: number): Promise<Commit[]> =>
      gitFileLog(repoPath, filePath, limit),
  })
}

export function createCommitGeneration(): CommitGeneration {
  return Object.freeze({
    generateMessage: (input: GitGenerateCommitMessageInput) =>
      generateCommitMessage(input.repoPath, input.model),
    generateGroups: (
      input: GitGenerateCommitGroupsInput,
    ): Promise<GitGenerateCommitGroupsOutput['groups']> =>
      generateCommitGroups(input.repoPath, input.model),
    listModels: () => listCommitModels(),
  })
}

export function createGitDiffReadingSources(): GitDiffReadingSources {
  return Object.freeze({
    loadWorkingFlow,
    loadRangeFlow,
    loadCommitFlow,
    workingHunks: (repoPath: string, path: string) =>
      gitDiffFile(repoPath, path).then((result) => result.hunks),
    rangeHunks: (repoPath: string, base: string, path: string) =>
      gitRangeDiffFile(repoPath, base, path).then((result) => result.hunks),
    diffFile: gitDiffFile,
    rangeDiffFile: gitRangeDiffFile,
    commitHunks: gitCommitDiff,
    commitMessage: gitCommitMessage,
  })
}

export function createWorkspaceTrash(): WorkspaceTrash {
  return Object.freeze({ moveToTrash })
}

export function createReviewMarks(): ReviewMarks {
  return Object.freeze({ clear: clearReviewedPaths })
}

export function createWorkingTreeCache(): WorkingTreeCache {
  return Object.freeze({ clear: clearWorkingTreeSnapshot })
}

export function createGitChangesPublisher(publish: (change: SessionChange) => void): GitChanges {
  return Object.freeze({
    publishWorkingTreeChanged(projectPath: string) {
      publish({ kind: 'git.working-tree-changed', projectPath })
    },
  })
}
