import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickCommandsGroup } from './quick-commands-group'

const runCommand = vi.fn(async () => 'ok')
const useGitSuggestions = vi.fn(() => [])
const useGitWorkspace = vi.fn()
const useQuickCommand = vi.fn(() => runCommand)

vi.mock('@renderer/features/git', () => ({
  useGitSuggestions: (): ReturnType<typeof useGitSuggestions> => useGitSuggestions(),
  useGitWorkspace: (): ReturnType<typeof useGitWorkspace> => useGitWorkspace(),
  useQuickCommand: (): ReturnType<typeof useQuickCommand> => useQuickCommand(),
}))

function workspace(head: {
  branch: string | null
  detachedSha: string | null
  upstream: string | null
}): void {
  useGitWorkspace.mockReturnValue({
    branch: head.branch ?? undefined,
    branches: [],
    head,
    refreshBranches: vi.fn().mockResolvedValue(undefined),
    worktrees: [],
  })
}

describe('QuickCommandsGroup', () => {
  beforeEach(() => {
    runCommand.mockClear()
    useGitSuggestions.mockReturnValue([])
    workspace({ branch: 'main', detachedSha: null, upstream: 'origin/main' })
  })

  it('runs push immediately when the branch already has a matching remote', async () => {
    render(<QuickCommandsGroup />)
    fireEvent.click(screen.getByRole('button', { name: 'push' }))
    expect(screen.queryByTestId(TestIds.publishBranchDialog)).not.toBeInTheDocument()
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('push'))
  })

  it('asks before creating a remote when the branch still tracks origin/main', async () => {
    workspace({ branch: 'work/topic', detachedSha: null, upstream: 'origin/main' })
    render(<QuickCommandsGroup />)

    fireEvent.click(screen.getByRole('button', { name: 'push' }))
    expect(runCommand).not.toHaveBeenCalled()
    expect(screen.getByTestId(TestIds.publishBranchDialog)).toHaveTextContent('origin/work/topic')
    expect(screen.getByTestId(TestIds.publishBranchDialog)).toHaveTextContent('origin/main')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(runCommand).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'push' }))
    fireEvent.click(screen.getByTestId(TestIds.publishBranchConfirm))
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('push'))
  })

  it('asks before the first publish when the branch has no upstream', async () => {
    workspace({ branch: 'work/topic', detachedSha: null, upstream: null })
    render(<QuickCommandsGroup />)

    fireEvent.click(screen.getByRole('button', { name: 'push' }))
    expect(screen.getByTestId(TestIds.publishBranchDialog)).toHaveTextContent('no remote yet')
    fireEvent.click(screen.getByTestId(TestIds.publishBranchConfirm))
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('push'))
  })

  it('does not prompt for commands other than push', async () => {
    workspace({ branch: 'work/topic', detachedSha: null, upstream: null })
    render(<QuickCommandsGroup />)
    fireEvent.click(screen.getByRole('button', { name: 'status' }))
    expect(screen.queryByTestId(TestIds.publishBranchDialog)).not.toBeInTheDocument()
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('status'))
  })
})
