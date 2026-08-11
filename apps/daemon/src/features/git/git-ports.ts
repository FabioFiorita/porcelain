import type { Worktree } from '@porcelain/contracts/git'

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
  addWorktree(repoPath: string, branch: string): Promise<GitWorkspaceResult<Worktree>>
}>
