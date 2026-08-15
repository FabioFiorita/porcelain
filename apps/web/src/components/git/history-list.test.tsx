import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useGitLog } from '@renderer/features/git'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryList } from './history-list'

// The convention: components read git data through domain hooks, so a component
// test mocks the hook module and never touches tRPC. useGitLog returns the
// commits this test wants to render.
vi.mock('@renderer/features/git', () => ({
  useFetchCommitMessage: () => vi.fn().mockResolvedValue(''),
  useGitLog: vi.fn(),
}))

const commits = [
  { hash: 'aaa1111', author: 'Ada', date: '2 days ago', subject: 'feat: add the widget' },
  { hash: 'bbb2222', author: 'Linus', date: '5 days ago', subject: 'fix: stop the leak' },
]

function renderList(): void {
  render(
    <SidebarProvider>
      <HistoryList />
    </SidebarProvider>,
  )
}

describe('HistoryList', () => {
  beforeEach(() => {
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    vi.mocked(useGitLog).mockReturnValue(commits)
  })

  it('renders each commit subject', () => {
    renderList()
    expect(screen.getByText('feat: add the widget')).toBeInTheDocument()
    expect(screen.getByText('fix: stop the leak')).toBeInTheDocument()
  })

  it('opens a commit tab keyed by hash when a row is clicked', () => {
    renderList()
    screen.getByText('feat: add the widget').click()

    const pane = useTabsStore.getState().panes[0]
    if (pane === undefined) throw new Error('expected pane 0')
    const { tabs, activeTabId } = pane
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({
      id: tabId('commit', 'aaa1111'),
      kind: 'commit',
      path: 'aaa1111',
    })
    expect(activeTabId).toBe(tabId('commit', 'aaa1111'))
  })

  it('renders the Empty state when the branch has no commits', () => {
    vi.mocked(useGitLog).mockReturnValue([])
    renderList()

    expect(screen.getByText('No commits yet')).toBeInTheDocument()
    expect(screen.getByText('No commits yet').closest('[data-slot="empty"]')).not.toBeNull()
  })
})
