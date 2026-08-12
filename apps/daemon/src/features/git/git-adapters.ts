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
import { generateCommitGroups, generateCommitMessage } from '../../git/commit-generation'
import {
  gitBranches,
  gitCommit,
  gitCommitFiles,
  gitCreateBranch,
  gitFileInHead,
  gitHead,
  gitLog,
  gitPush,
  gitQuickCommand,
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
import { clearReviewedPaths } from '../../stores/reviewed-store'
import type {
  CommitGeneration,
  GitChanges,
  GitProjectResult,
  ProjectGit,
  ReviewMarks,
  WorkingTreeCache,
  WorkspaceTrash,
} from './git-ports'

function nativeOutput(error: unknown): string {
  if (error !== null && typeof error === 'object') {
    const parts: string[] = []
    if ('stderr' in error && typeof error.stderr === 'string') parts.push(error.stderr)
    if ('stdout' in error && typeof error.stdout === 'string') parts.push(error.stdout)
    if (parts.length > 0) return parts.join('\n')
  }
  return String(error)
}

function isNotARepository(error: unknown): boolean {
  return nativeOutput(error).toLowerCase().includes('not a git repository')
}

async function repositoryRead<Value>(read: () => Promise<Value>): Promise<GitProjectResult<Value>> {
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
