import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useFileLog } from '@renderer/hooks/use-history'
import { type Tab, tabId, useTabsStore } from '@renderer/stores/tabs'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileTimelineGroup } from './file-timeline-group'

// Like the History list test: mock the domain hook, never tRPC. useFileLog
// returns the file's commit history; useFetchCommitMessage backs the shared
// CommitContextMenu (copy actions).
vi.mock('@renderer/hooks/use-history', () => ({
  useFileLog: vi.fn(),
  useFetchCommitMessage: () => vi.fn().mockResolvedValue(''),
}))

const commits = [
  { hash: 'aaa1111', author: 'Ada', date: '2 days ago', subject: 'feat: add the widget' },
  { hash: 'bbb2222', author: 'Linus', date: '5 days ago', subject: 'fix: stop the leak' },
]

function openFileTab(path: string): void {
  const tab: Tab = { id: tabId('file', path), kind: 'file', title: 'x', path }
  useTabsStore.setState({ panes: [{ tabs: [tab], activeTabId: tab.id }], activePaneIndex: 0 })
}

function renderGroup(): void {
  render(
    <SidebarProvider>
      <FileTimelineGroup />
    </SidebarProvider>,
  )
}

describe('FileTimelineGroup', () => {
  beforeEach(() => {
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    vi.mocked(useFileLog).mockReturnValue(commits)
  })

  it('prompts to open a file when no file tab is active', () => {
    vi.mocked(useFileLog).mockReturnValue(undefined)
    renderGroup()
    expect(screen.getByText('Open a file to see its timeline.')).toBeInTheDocument()
  })

  it('renders the active file name and each commit in its history', () => {
    openFileTab('/repo/src/foo/bar.ts')
    renderGroup()
    expect(screen.getByText('bar.ts')).toBeInTheDocument()
    expect(screen.getByText('feat: add the widget')).toBeInTheDocument()
    expect(screen.getByText('fix: stop the leak')).toBeInTheDocument()
  })

  it('shows an empty state for a file with no history yet', () => {
    openFileTab('/repo/src/foo/bar.ts')
    vi.mocked(useFileLog).mockReturnValue([])
    renderGroup()
    expect(screen.getByText('No history for this file yet.')).toBeInTheDocument()
  })

  it('opens a commit tab keyed by hash when a timeline row is clicked', () => {
    openFileTab('/repo/src/foo/bar.ts')
    renderGroup()
    screen.getByText('feat: add the widget').click()

    const { tabs, activeTabId } = useTabsStore.getState().panes[0]
    expect(tabs.some((t) => t.id === tabId('commit', 'aaa1111'))).toBe(true)
    expect(activeTabId).toBe(tabId('commit', 'aaa1111'))
  })
})
