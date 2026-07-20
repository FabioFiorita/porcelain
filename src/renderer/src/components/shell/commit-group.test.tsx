import type { CommitConventions } from '@backend/conventions'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useCommit, useCommitConventions, useStageAll } from '@renderer/hooks/use-commit'
import { useGitFlow } from '@renderer/hooks/use-git-flow'
import { useCommitDraftStore } from '@renderer/stores/commit-draft'
import { useRepoStore } from '@renderer/stores/repo'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommitGroup } from './commit-group'

// Same convention as changes-list: mock the domain hooks, never the tRPC proxy.
vi.mock('@renderer/hooks/use-commit', () => ({
  useCommit: vi.fn(),
  useCommitConventions: vi.fn(),
  useStageAll: vi.fn(),
}))
vi.mock('@renderer/hooks/use-git-flow', () => ({
  useGitFlow: vi.fn(),
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
  beforeEach(() => {
    useRepoStore.setState({ repo: { path: '/repo', name: 'repo' } })
    useCommitDraftStore.setState({ messages: {} })
    vi.mocked(useCommit).mockReturnValue({ commit: vi.fn(), isCommitting: false, error: null })
    vi.mocked(useCommitConventions).mockReturnValue(conventions)
    vi.mocked(useStageAll).mockReturnValue({
      stageAll: async () => {},
      unstageAll: async () => {},
      isStaging: false,
    })
    vi.mocked(useGitFlow).mockReturnValue({ groups: [], refresh: async () => {} })
  })

  it('renders the commit composer without a Push button (push lives in Quick Commands)', () => {
    renderGroup()
    expect(screen.getByRole('button', { name: 'Commit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Push' })).not.toBeInTheDocument()
  })
})
