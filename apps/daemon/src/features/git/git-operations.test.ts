// @vitest-environment node
import type { GitAddWorktreeInput, GitCheckoutInput } from '@porcelain/contracts/git'
import { describe, expect, it, vi } from 'vitest'
import { createGitOperations } from './git-operations'
import type { GitWorkspaceError, GitWorkspacePort } from './git-ports'

const CHECKOUT_INPUT: GitCheckoutInput = { repoPath: '/synthetic/repo', branch: 'main' }
const WORKTREE_INPUT: GitAddWorktreeInput = {
  repoPath: '/synthetic/repo',
  branch: 'feature/x',
}

function workspace(overrides: Partial<GitWorkspacePort> = {}): GitWorkspacePort {
  return {
    checkout: vi.fn(async () => ({ ok: true, value: undefined })),
    addWorktree: vi.fn(async () => ({
      ok: true,
      value: { path: '/synthetic/repo-worktrees/feature-x', branch: 'feature/x' },
    })),
    ...overrides,
  }
}

describe('Git operations', () => {
  it('passes contract inputs to the matching workspace capability', async () => {
    const port = workspace()
    const operations = createGitOperations({ workspace: port })

    await expect(operations.checkoutGit(CHECKOUT_INPUT)).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    await expect(operations.addGitWorktree(WORKTREE_INPUT)).resolves.toEqual({
      ok: true,
      value: { path: '/synthetic/repo-worktrees/feature-x', branch: 'feature/x' },
    })
    expect(port.checkout).toHaveBeenCalledWith('/synthetic/repo', 'main')
    expect(port.addWorktree).toHaveBeenCalledWith('/synthetic/repo', 'feature/x')
  })

  it('returns each typed workspace failure unchanged', async () => {
    const errors = [
      { code: 'git.not-a-repository' },
      { code: 'git.branch-not-found' },
      { code: 'git.branch-already-exists' },
      { code: 'git.worktree-conflict' },
      { code: 'git.working-tree-conflict' },
    ] satisfies GitWorkspaceError[]

    for (const error of errors) {
      const port = workspace({
        checkout: vi.fn(async () => ({ ok: false, error })),
        addWorktree: vi.fn(async () => ({ ok: false, error })),
      })
      const operations = createGitOperations({ workspace: port })

      await expect(operations.checkoutGit(CHECKOUT_INPUT)).resolves.toEqual({
        ok: false,
        error,
      })
      await expect(operations.addGitWorktree(WORKTREE_INPUT)).resolves.toEqual({
        ok: false,
        error,
      })
    }
  })

  it('returns a frozen operation catalog', () => {
    expect(Object.isFrozen(createGitOperations({ workspace: workspace() }))).toBe(true)
  })
})
