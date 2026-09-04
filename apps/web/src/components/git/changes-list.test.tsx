import type { FlowFile } from '@porcelain/contracts/git'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useGitFlow, useReviewedPaths } from '@renderer/features/git'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangesList } from './changes-list'

vi.mock('@renderer/features/git', () => ({
  useBranchFlow: () => ({ groups: undefined, base: undefined, error: null }),
  useDiffFileHoverPrefetch: () => () => {},
  useDiscardFile: () => async () => {},
  useFileStaging: () => ({ stageFile: async () => {}, unstageFile: async () => {} }),
  useGitFlow: vi.fn(),
  useReviewedPaths: vi.fn(),
  useSetReviewed: () => () => {},
  useToggleReviewed: () => ({ mark: () => {}, unmark: () => {} }),
}))
vi.mock('@renderer/features/review', () => ({
  useCommentActions: () => ({ add: async () => {} }),
  useCommentIndex: () => ({ byLine: new Map(), fileLevel: [] }),
  useReviewComments: () => [],
  useReviewReadiness: () => ({ readiness: undefined, error: null }),
}))

const files: FlowFile[] = [
  { path: 'src/app.ts', status: 'modified', staged: false, unstaged: true, connects: [] },
  { path: 'src/util.ts', status: 'modified', staged: false, unstaged: true, connects: [] },
]

function renderList(): void {
  render(
    <SidebarProvider>
      <ChangesList />
    </SidebarProvider>,
  )
}

describe('ChangesList', () => {
  const refresh = vi.fn(async () => {})

  beforeEach(() => {
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useProjectSelectionStore.setState({ project: { name: 'repo', path: '/repo' } })
    refresh.mockClear()
    vi.mocked(useGitFlow).mockReturnValue({
      error: null,
      groups: [{ layer: 'Source', files }],
      refresh,
    })
    vi.mocked(useReviewedPaths).mockReturnValue(new Set<string>())
  })

  it('marks only the row whose diff is open in the viewer', () => {
    const open = {
      id: tabId('diff', 'src/app.ts'),
      kind: 'diff' as const,
      title: 'app.ts',
      path: 'src/app.ts',
    }
    useTabsStore.setState({ panes: [{ tabs: [open], activeTabId: open.id }], activePaneIndex: 0 })
    renderList()

    expect(screen.getByTestId(TestIds.changesFile('app.ts'))).toHaveAttribute('data-active')
    expect(screen.getByTestId(TestIds.changesFile('util.ts'))).not.toHaveAttribute('data-active')
  })

  it('does not mark a working-tree row when the open diff is a branch diff', () => {
    const open = {
      id: tabId('diff', 'main:src/app.ts'),
      kind: 'diff' as const,
      title: 'app.ts',
      path: 'src/app.ts',
      base: 'main',
    }
    useTabsStore.setState({ panes: [{ tabs: [open], activeTabId: open.id }], activePaneIndex: 0 })
    renderList()

    expect(screen.getByTestId(TestIds.changesFile('app.ts'))).not.toHaveAttribute('data-active')
  })

  it('does not mark a row when the open diff belongs to another worktree', () => {
    const open = {
      id: tabId('diff', 'src/app.ts'),
      kind: 'diff' as const,
      title: 'app.ts',
      path: 'src/app.ts',
      target: {
        environmentId: 'local',
        projectId: 'other',
        worktreeId: 'main',
        path: '/other-repo',
      },
    }
    useTabsStore.setState({ panes: [{ tabs: [open], activeTabId: open.id }], activePaneIndex: 0 })
    renderList()

    expect(screen.getByTestId(TestIds.changesFile('app.ts'))).not.toHaveAttribute('data-active')
  })

  it('shows the reviewed mark only on files the human marked reviewed', () => {
    vi.mocked(useReviewedPaths).mockReturnValue(new Set(['src/app.ts']))
    renderList()

    expect(screen.getByTestId(TestIds.changesFile('app.ts'))).toHaveAttribute(
      'data-reviewed',
      'true',
    )
    expect(screen.getByTestId(TestIds.changesFile('util.ts'))).toHaveAttribute(
      'data-reviewed',
      'false',
    )
    expect(screen.getAllByLabelText('Reviewed')).toHaveLength(1)
  })

  it('shows a failed Environment read and lets the human retry instead of loading forever', () => {
    vi.mocked(useGitFlow).mockReturnValue({
      error: { message: 'The target Environment is offline.' },
      groups: undefined,
      refresh,
    })

    renderList()

    expect(screen.getByText('The target Environment is offline.')).toBeVisible()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refresh).toHaveBeenCalledOnce()
  })
})
