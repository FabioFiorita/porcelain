import type { BranchRef } from '@porcelain/contracts/git'
import type { HubProject } from '@porcelain/contracts/projects'
import { useGitBranches } from '@renderer/features/git'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateWorktreeDialog } from './create-worktree-dialog'

vi.mock('@renderer/features/git', () => ({
  useGitBranches: vi.fn(),
}))

if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = (): void => {}
}

const project: HubProject = {
  id: 'project-alpha',
  environmentId: 'environment-synthetic',
  name: 'alpha',
  groupingKey: 'name:alpha',
  path: '/projects/alpha',
  worktrees: [],
}

const branches: BranchRef[] = [
  { name: 'main', remote: null },
  { name: 'development', remote: 'origin' },
]

describe('CreateWorktreeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useGitBranches).mockReturnValue({
      branches,
      isFetching: false,
      refreshBranches: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('creates a worktree from the selected local or remote ref', async () => {
    const createWorktree = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()
    render(
      <CreateWorktreeDialog
        project={project}
        open
        creating={false}
        onOpenChange={onOpenChange}
        createWorktree={createWorktree}
      />,
    )

    fireEvent.click(screen.getByTestId(TestIds.hubCreateWorktreeBase))
    fireEvent.click(await screen.findByRole('option', { name: 'origin/development' }))
    fireEvent.change(screen.getByTestId(TestIds.hubCreateWorktreeBranch), {
      target: { value: 'feature/from-development' },
    })
    fireEvent.click(screen.getByTestId(TestIds.hubCreateWorktreeSubmit))

    await waitFor(() => {
      expect(createWorktree).toHaveBeenCalledWith({
        projectId: 'project-alpha',
        branch: 'feature/from-development',
        baseRef: 'origin/development',
      })
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('checks out an existing branch into a new worktree', async () => {
    const createWorktree = vi.fn().mockResolvedValue(undefined)
    render(
      <CreateWorktreeDialog
        project={project}
        open
        creating={false}
        onOpenChange={vi.fn()}
        createWorktree={createWorktree}
      />,
    )

    fireEvent.click(screen.getByTestId(TestIds.hubCreateWorktreeModeExisting))
    fireEvent.click(screen.getByTestId(TestIds.hubCreateWorktreeBase))
    fireEvent.click(await screen.findByRole('option', { name: 'main' }))
    fireEvent.click(screen.getByTestId(TestIds.hubCreateWorktreeSubmit))

    await waitFor(() => {
      expect(createWorktree).toHaveBeenCalledWith({
        projectId: 'project-alpha',
        branch: 'main',
        existing: true,
      })
    })
    expect(screen.queryByTestId(TestIds.hubCreateWorktreeBranch)).toBeNull()
  })
})
