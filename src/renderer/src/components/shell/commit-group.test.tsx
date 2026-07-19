import type { CommitConventions } from '@backend/conventions'
import type { GitSuggestion } from '@backend/suggestions'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useCommit, useCommitConventions, usePush, useStageAll } from '@renderer/hooks/use-commit'
import { useGitFlow, useGitSuggestions } from '@renderer/hooks/use-git-flow'
import { useCommitDraftStore } from '@renderer/stores/commit-draft'
import { useRepoStore } from '@renderer/stores/repo'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommitGroup } from './commit-group'

// Same convention as changes-list: mock the domain hooks, never the tRPC proxy.
vi.mock('@renderer/hooks/use-commit', () => ({
  useCommit: vi.fn(),
  useCommitConventions: vi.fn(),
  usePush: vi.fn(),
  useStageAll: vi.fn(),
}))
vi.mock('@renderer/hooks/use-git-flow', () => ({
  useGitFlow: vi.fn(),
  useGitSuggestions: vi.fn(),
}))

const conventions: CommitConventions = { types: ['feat', 'fix'], scopes: ['ui'] }

function renderGroup(): void {
  render(
    <SidebarProvider>
      <CommitGroup />
    </SidebarProvider>,
  )
}

describe('CommitGroup', () => {
  const pushFn = vi.fn(async () => '')

  beforeEach(() => {
    useRepoStore.setState({ repo: { path: '/repo', name: 'repo' } })
    useCommitDraftStore.setState({ messages: {} })
    pushFn.mockClear()
    vi.mocked(useCommit).mockReturnValue({ commit: vi.fn(), isCommitting: false, error: null })
    vi.mocked(useCommitConventions).mockReturnValue(conventions)
    vi.mocked(useStageAll).mockReturnValue({
      stageAll: async () => {},
      unstageAll: async () => {},
      isStaging: false,
    })
    vi.mocked(usePush).mockReturnValue({ push: pushFn, isPushing: false, error: null })
    vi.mocked(useGitFlow).mockReturnValue({ groups: [], refresh: async () => {} })
    vi.mocked(useGitSuggestions).mockReturnValue([])
  })

  it('shows no Push button when there is no push suggestion', () => {
    renderGroup()
    expect(screen.queryByRole('button', { name: 'Push' })).not.toBeInTheDocument()
  })

  it('renders the push reason and a Push button when a push suggestion exists', () => {
    const suggestion: GitSuggestion = { command: 'push', reason: '2 unpushed commits' }
    vi.mocked(useGitSuggestions).mockReturnValue([suggestion])
    renderGroup()
    expect(screen.getByText('2 unpushed commits')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Push' })).toBeInTheDocument()
  })

  it('calls the push hook when the Push button is clicked', () => {
    const suggestion: GitSuggestion = { command: 'push', reason: '1 unpushed commit' }
    vi.mocked(useGitSuggestions).mockReturnValue([suggestion])
    renderGroup()
    screen.getByRole('button', { name: 'Push' }).click()
    expect(pushFn).toHaveBeenCalledOnce()
  })
})
