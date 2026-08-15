import type { FlowGroup } from '@backend/review/flow'
import type { ReviewReading } from '@porcelain/contracts/review'
import { type ReviewInboxRow, useGitFlow, useGitWorkspace } from '@renderer/features/git'
import { useReviewComments, useReviewReading } from '@renderer/features/review'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GlanceHome } from './glance-home'

// Same convention as changes-list/review-list: mock the domain hooks, never the
// tRPC proxy. Each returns exactly the shape its real query hands back.
vi.mock('@renderer/features/git', () => ({
  useGitFlow: vi.fn(),
  useGitWorkspace: vi.fn(),
}))
vi.mock('@renderer/features/review', () => ({
  useReviewReading: vi.fn(),
  useReviewComments: vi.fn(),
}))
const openTerminalPanel = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@renderer/lib/terminal-actions', () => ({ openTerminalPanel }))

const switchToSpy = vi.fn(async () => {})

const inboxRow: ReviewInboxRow = {
  path: '/repo-worktrees/fix-nav',
  branch: 'fix-nav',
  changedCount: 4,
  hasReview: true,
}

const flowGroups: FlowGroup[] = [
  {
    layer: 'Components',
    files: [
      { path: 'src/a.tsx', status: 'modified', connects: [] },
      { path: 'src/b.tsx', status: 'added', connects: [] },
    ],
  },
]

const reading: ReviewReading = {
  name: 'Glance home',
  sections: [],
  groups: [],
  evidence: null,
}

/** Reset every mock to a fully empty repo; tests layer their data on top. */
function mockEmpty(): void {
  vi.mocked(useGitWorkspace).mockReturnValue({
    branch: 'main',
    branches: [],
    head: undefined,
    inbox: [],
    refreshBranches: vi.fn().mockResolvedValue(undefined),
    worktrees: [],
  })
  vi.mocked(useGitFlow).mockReturnValue({ groups: [], refresh: async () => {} })
  vi.mocked(useReviewReading).mockReturnValue({ reading: null, refresh: async () => {} })
  vi.mocked(useReviewComments).mockReturnValue([])
}

describe('GlanceHome', () => {
  beforeEach(() => {
    switchToSpy.mockClear()
    openTerminalPanel.mockImplementation(async () => {
      useTerminalsStore.getState().openPanel()
    })
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useProjectSelectionStore.setState({
      project: { path: '/repo', name: 'repo' },
      switchProject: switchToSpy,
    })
    usePreferencesStore.setState({ sidebarTab: 'files' })
    useTerminalsStore.setState({ sessions: [], panelOpen: false, panelSessionId: null })
    mockEmpty()
  })

  it('renders repo name, branch, and always-on Jump to rows', () => {
    render(<GlanceHome />)
    expect(screen.getByText('repo')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('Jump to')).toBeInTheDocument()
    expect(screen.getByTestId('glance-jump-changes')).toBeInTheDocument()
    expect(screen.getByTestId('glance-jump-review')).toBeInTheDocument()
    expect(screen.queryByTestId('glance-jump-board')).not.toBeInTheDocument()
    expect(screen.getByTestId('glance-jump-terminal')).toBeInTheDocument()
  })

  it('renders inbox rows with their changed count, and tapping one switches to that worktree', () => {
    vi.mocked(useGitWorkspace).mockReturnValue({
      branch: 'main',
      branches: [],
      head: undefined,
      inbox: [inboxRow],
      refreshBranches: vi.fn().mockResolvedValue(undefined),
      worktrees: [],
    })
    render(<GlanceHome />)
    expect(screen.getByText('Review inbox')).toBeInTheDocument()
    expect(screen.getByLabelText('Review pushed')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    fireEvent.click(screen.getByText('fix-nav'))
    expect(switchToSpy).toHaveBeenCalledWith('/repo-worktrees/fix-nav')
  })

  it('opens All changes for dirty tree and Review for a published set', () => {
    vi.mocked(useGitFlow).mockReturnValue({ groups: flowGroups, refresh: async () => {} })
    vi.mocked(useReviewReading).mockReturnValue({ reading, refresh: async () => {} })
    render(<GlanceHome />)
    expect(screen.getByText('This checkout')).toBeInTheDocument()
    expect(screen.getByLabelText('Review published')).toBeInTheDocument()
    fireEvent.click(screen.getByText('2 changed files'))
    const paneBefore = useTabsStore.getState().panes[0]
    if (paneBefore === undefined) throw new Error('expected pane 0')
    expect(paneBefore.tabs[0]).toMatchObject({
      id: tabId('changeset', 'working'),
      kind: 'changeset',
    })
    expect(usePreferencesStore.getState().sidebarTab).toBe('changes')
    fireEvent.click(screen.getByText('Glance home'))
    const paneAfter = useTabsStore.getState().panes[0]
    if (paneAfter === undefined) throw new Error('expected pane 0')
    const reviewTab = paneAfter.tabs.find((t) => t.kind === 'review')
    expect(reviewTab).toMatchObject({ id: tabId('review', '/repo'), kind: 'review' })
    expect(usePreferencesStore.getState().sidebarTab).toBe('review')
  })

  it('shows a quiet empty line when nothing is in flight, but keeps Jump to', () => {
    render(<GlanceHome />)
    expect(screen.getByText(/Nothing in flight/)).toBeInTheDocument()
    expect(screen.queryByText('Review inbox')).not.toBeInTheDocument()
    expect(screen.queryByText('This checkout')).not.toBeInTheDocument()
    expect(screen.getByText('Jump to')).toBeInTheDocument()
  })

  it('surfaces open review comments under This checkout', () => {
    vi.mocked(useReviewComments).mockReturnValue([
      {
        id: 'c1',
        path: 'src/a.tsx',
        body: 'fix me',
        createdAt: 0,
        resolved: false,
      },
    ])
    render(<GlanceHome />)
    expect(screen.getByText('This checkout')).toBeInTheDocument()
    expect(screen.getByText('1 open review comment')).toBeInTheDocument()
  })

  it('Jump to Terminal opens the bottom terminal panel', () => {
    render(<GlanceHome />)
    fireEvent.click(screen.getByTestId('glance-jump-terminal'))
    expect(openTerminalPanel).toHaveBeenCalledOnce()
    expect(useTerminalsStore.getState().panelOpen).toBe(true)
  })
})
