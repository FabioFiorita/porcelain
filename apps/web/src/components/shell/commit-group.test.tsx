import type { FlowGroup } from '@backend/review/flow'
import type { CommitConventions } from '@porcelain/contracts/git'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import {
  useApplyCommitGroups,
  useCommit,
  useCommitConventions,
  useCommitGeneration,
  useGitFlow,
  useStageAll,
} from '@renderer/features/git'
import { useCommitDraftStore } from '@renderer/stores/commit-draft'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommitGroup } from './commit-group'

// cmdk calls scrollIntoView on the selected item; jsdom doesn't ship it.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = (): void => {}
}

// Same convention as changes-list: mock the domain hooks, never the tRPC proxy.
vi.mock('@renderer/features/git', () => ({
  useApplyCommitGroups: vi.fn(),
  useCommit: vi.fn(),
  useCommitConventions: vi.fn(),
  useCommitGeneration: vi.fn(),
  useGitFlow: vi.fn(),
  useStageAll: vi.fn(),
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
    useProjectSelectionStore.setState({ project: { path: '/repo', name: 'repo' } })
    useCommitDraftStore.setState({ messages: {} })
    vi.mocked(useCommit).mockReturnValue({ commit: vi.fn(), isCommitting: false, error: null })
    vi.mocked(useCommitConventions).mockReturnValue(conventions)
    vi.mocked(useCommitGeneration).mockReturnValue({
      generateMessage: async () => 'feat: generated message',
      generateGroups: async () => [
        { files: ['src/a.ts'], message: 'feat: grouped change' },
        { files: ['src/b.ts'], message: 'fix: second group' },
      ],
      isGenerating: false,
    })
    vi.mocked(useApplyCommitGroups).mockReturnValue({
      applyGroups: async () => [],
      isApplying: false,
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

  it('keeps the type picker list off the Add type field', () => {
    vi.mocked(useGitFlow).mockReturnValue({
      groups: changedFiles(false, true),
      refresh: async () => {},
    })
    renderGroup()
    fireEvent.click(screen.getByRole('button', { name: /type/i }))
    const wrapper = document.querySelector('[data-slot="command-input-wrapper"]')
    expect(wrapper?.className).toContain('p-1')
    expect(wrapper?.className).not.toContain('pb-0')
    const command = document.querySelector('[data-slot="command"]')
    expect(command?.className).toContain('gap-1')
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

  it('accepts the whole proposal in one click — no per-group stage or commit button', async () => {
    const applyGroups = vi.fn(async () => [
      {
        files: ['src/a.ts'],
        message: 'feat: grouped change',
        status: 'committed' as const,
        error: null,
      },
      {
        files: ['src/b.ts'],
        message: 'fix: second group',
        status: 'committed' as const,
        error: null,
      },
    ])
    vi.mocked(useApplyCommitGroups).mockReturnValue({ applyGroups, isApplying: false })
    vi.mocked(useGitFlow).mockReturnValue({
      groups: changedFiles(false, true),
      refresh: async () => {},
    })
    renderGroup()

    fireEvent.click(screen.getByRole('button', { name: 'Generate Group Commit' }))
    const accept = await screen.findByTestId(TestIds.acceptCommitGroups)
    expect(accept).toHaveTextContent('Accept all — commit 2 groups')
    // The old flow made the human stage each group and then press Commit.
    expect(screen.queryByRole('button', { name: 'Stage group' })).not.toBeInTheDocument()

    fireEvent.click(accept)

    await waitFor(() => {
      expect(applyGroups).toHaveBeenCalledWith([
        { files: ['src/a.ts'], message: 'feat: grouped change' },
        { files: ['src/b.ts'], message: 'fix: second group' },
      ])
    })
    // A fully applied proposal is gone — the working tree it described no longer exists.
    await waitFor(() => {
      expect(screen.queryByTestId(TestIds.acceptCommitGroups)).not.toBeInTheDocument()
    })
    expect(screen.getByText('Committed 2 groups')).toBeInTheDocument()
  })

  it('keeps the groups that did not land when the batch stops on a failure', async () => {
    vi.mocked(useApplyCommitGroups).mockReturnValue({
      applyGroups: async () => [
        {
          files: ['src/a.ts'],
          message: 'feat: grouped change',
          status: 'committed' as const,
          error: null,
        },
        {
          files: ['src/b.ts'],
          message: 'fix: second group',
          status: 'failed' as const,
          error: 'nothing to commit',
        },
      ],
      isApplying: false,
    })
    vi.mocked(useGitFlow).mockReturnValue({
      groups: changedFiles(false, true),
      refresh: async () => {},
    })
    renderGroup()

    fireEvent.click(screen.getByRole('button', { name: 'Generate Group Commit' }))
    fireEvent.click(await screen.findByTestId(TestIds.acceptCommitGroups))

    await screen.findByText(/Committed 1 of 2 groups/)
    // Only the unlanded group is still offered, so a retry cannot double-commit.
    await waitFor(() => {
      expect(screen.getByTestId(TestIds.acceptCommitGroups)).toHaveTextContent(
        'Accept all — commit 1 group',
      )
    })
    expect(screen.queryByText('feat: grouped change')).not.toBeInTheDocument()
  })

  it('reports a failed generation once, not once per error channel', async () => {
    const failure = 'Unable to generate a commit message with sonnet: Not logged in'
    vi.mocked(useGitFlow).mockReturnValue({
      groups: changedFiles(false, true),
      refresh: async () => {},
    })
    vi.mocked(useCommitGeneration).mockReturnValue({
      generateMessage: async () => '',
      generateGroups: () => Promise.reject(new Error(failure)),
      isGenerating: false,
    })
    renderGroup()

    fireEvent.click(screen.getByRole('button', { name: 'Generate Group Commit' }))

    // findByText throws on multiple matches, so it fails outright if the composer
    // grows a second error channel again; the count keeps that explicit.
    await screen.findByText(failure)
    expect(screen.getAllByText(failure)).toHaveLength(1)
  })
})
