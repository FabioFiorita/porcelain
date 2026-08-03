import type { CommitConventions } from '@backend/git/conventions'
import type { FlowGroup } from '@backend/review/flow'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import {
  useCommit,
  useCommitConventions,
  useCommitGeneration,
  useFileStaging,
  useStageAll,
} from '@renderer/hooks/use-commit'
import { useGitFlow } from '@renderer/hooks/use-git-flow'
import { useCommitDraftStore } from '@renderer/stores/commit-draft'
import { useRepoStore } from '@renderer/stores/repo'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommitGroup } from './commit-group'

// Same convention as changes-list: mock the domain hooks, never the tRPC proxy.
vi.mock('@renderer/hooks/use-commit', () => ({
  useCommit: vi.fn(),
  useCommitConventions: vi.fn(),
  useCommitGeneration: vi.fn(),
  useFileStaging: vi.fn(),
  useStageAll: vi.fn(),
}))
vi.mock('@renderer/hooks/use-git-flow', () => ({
  useGitFlow: vi.fn(),
}))

const conventions: CommitConventions = { types: ['feat', 'fix'], scopes: ['ui'] }

function changedFiles(staged: boolean, unstaged: boolean): FlowGroup[] {
  return [
    {
      layer: 'Other',
      files: [
        {
          path: 'src/a.ts',
          status: 'modified',
          staged,
          unstaged,
          connects: [],
        },
      ],
    },
  ]
}

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
    vi.mocked(useCommitGeneration).mockReturnValue({
      generateMessage: async () => 'feat: generated message',
      generateGroups: async () => [{ files: ['src/a.ts'], message: 'feat: grouped change' }],
      isGenerating: false,
      error: null,
    })
    vi.mocked(useFileStaging).mockReturnValue({
      stageFile: async () => {},
      unstageFile: async () => {},
    })
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

  it('offers group generation only when changes are unstaged', () => {
    vi.mocked(useGitFlow).mockReturnValue({
      groups: changedFiles(false, true),
      refresh: async () => {},
    })
    renderGroup()

    expect(screen.getByRole('button', { name: 'Generate Group Commit' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Generate Commit Message' })).toBeDisabled()
  })

  it('generates a staged commit message into the composer without committing', async () => {
    vi.mocked(useGitFlow).mockReturnValue({
      groups: changedFiles(true, false),
      refresh: async () => {},
    })
    renderGroup()

    fireEvent.click(screen.getByRole('button', { name: 'Generate Commit Message' }))

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Commit message' })).toHaveValue(
        'feat: generated message',
      )
    })
    expect(screen.getByRole('button', { name: 'Generate Group Commit' })).toBeDisabled()
  })
})
