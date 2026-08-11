import type { GitAddWorktreeInput, GitCheckoutInput, Worktree } from '@porcelain/contracts/git'
import type { GitWorkspacePort, GitWorkspaceResult } from './git-ports'
import { createGitSubprocess } from './git-subprocess'

export type GitOperations = Readonly<{
  checkoutGit(input: GitCheckoutInput): Promise<GitWorkspaceResult<void>>
  addGitWorktree(input: GitAddWorktreeInput): Promise<GitWorkspaceResult<Worktree>>
}>

export function createGitOperations(options: { workspace?: GitWorkspacePort } = {}): GitOperations {
  const workspace = options.workspace ?? createGitSubprocess()
  return Object.freeze({
    checkoutGit: (input: GitCheckoutInput) => workspace.checkout(input.repoPath, input.branch),
    addGitWorktree: (input: GitAddWorktreeInput) =>
      workspace.addWorktree(input.repoPath, input.branch),
  })
}
