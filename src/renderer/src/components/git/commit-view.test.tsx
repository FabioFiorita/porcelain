import type { FlowGroup } from '@backend/flow'
import { useCommitFlow, useCommitMessage } from '@renderer/hooks/use-history'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommitView } from './commit-view'

// Mock domain hooks so the component renders without a tRPC provider — exactly
// like changes-list.test.tsx mocks useGitFlow/useBranchFlow.
vi.mock('@renderer/hooks/use-history', () => ({
  useCommitFlow: vi.fn(),
  useCommitMessage: vi.fn(),
}))
// CommitFileDiff reaches useCommitDiff which would need tRPC; stub it out so
// clicking a file row doesn't break on an un-wired provider.
vi.mock('@renderer/hooks/use-diff', () => ({
  useCommitDiff: () => ({ hunks: undefined, error: undefined }),
}))
// File rows and the diff pane mount CommentComposer and read the comment index,
// both of which reach tRPC; mock the domain hooks so the view renders without a
// provider (same convention as changes-list.test.tsx).
vi.mock('@renderer/hooks/use-comments', () => ({
  useCommentIndex: () => ({ byLine: new Map(), fileLevel: [] }),
  useCommentActions: () => ({ add: async () => {} }),
}))

const groups: FlowGroup[] = [
  {
    layer: 'Components',
    files: [
      {
        path: 'src/components/widget.tsx',
        status: 'modified',
        connects: [],
        additions: 5,
        deletions: 2,
        staged: false,
        unstaged: true,
      },
    ],
  },
  {
    layer: 'Data',
    files: [
      {
        path: 'src/db/schema.ts',
        status: 'added',
        connects: [],
        additions: 20,
        deletions: 0,
        staged: false,
        unstaged: false,
      },
    ],
  },
]

const HASH = 'abc123def456'

function renderView(): void {
  render(<CommitView hash={HASH} />)
}

describe('CommitView', () => {
  beforeEach(() => {
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useRepoStore.setState({ repo: { path: '/repo', name: 'repo' } })
    usePreferencesStore.setState({ diffMode: 'unified' })
    vi.mocked(useCommitFlow).mockReturnValue({ groups })
    vi.mocked(useCommitMessage).mockReturnValue('feat: add widget and schema')
  })

  it('renders both layer labels', () => {
    renderView()
    expect(screen.getByText('Components')).toBeInTheDocument()
    expect(screen.getByText('Data')).toBeInTheDocument()
  })

  it('renders a file row for each file under its layer', () => {
    renderView()
    // Basename displayed, not full path
    expect(screen.getByText('widget.tsx')).toBeInTheDocument()
    expect(screen.getByText('schema.ts')).toBeInTheDocument()
  })

  it('renders the commit message and short hash', () => {
    renderView()
    expect(screen.getByText('feat: add widget and schema')).toBeInTheDocument()
    expect(screen.getByText(HASH.slice(0, 12))).toBeInTheDocument()
  })

  it('clicking a file row in any group opens its diff in the right pane', () => {
    renderView()
    // Click the second group's file — schema.ts (in the Data layer)
    fireEvent.click(screen.getByText('schema.ts'))

    // The diff pane header should now show the full path of the clicked file
    expect(screen.getByText('src/db/schema.ts')).toBeInTheDocument()
  })

  it('shows Loading when groups is undefined', () => {
    vi.mocked(useCommitFlow).mockReturnValue({ groups: undefined })
    renderView()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the "No files changed" message for an empty commit (zero groups)', () => {
    vi.mocked(useCommitFlow).mockReturnValue({ groups: [] })
    renderView()
    expect(screen.getByText('No files changed')).toBeInTheDocument()
  })

  it('opens a continuous review tab for the commit when Review all is clicked', () => {
    renderView()
    fireEvent.click(screen.getByLabelText('Review all'))

    const key = `commit:${HASH}`
    const { tabs, activeTabId } = useTabsStore.getState().panes[0]
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({
      id: tabId('review', key),
      kind: 'review',
      path: key,
      title: 'feat: add widget and schema',
    })
    expect(activeTabId).toBe(tabId('review', key))
  })

  it('hides Review all when the commit has no files', () => {
    vi.mocked(useCommitFlow).mockReturnValue({ groups: [] })
    renderView()
    expect(screen.queryByLabelText('Review all')).not.toBeInTheDocument()
  })
})
