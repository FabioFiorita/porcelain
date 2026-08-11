import type { InboxRow } from '@backend/git/worktree-inbox'
import type { FeatureReading } from '@backend/review/feature-view'
import type { FlowGroup } from '@backend/review/flow'
import type { BoardCard } from '@porcelain/contracts/board'
import { useBoardCards } from '@renderer/features/board'
import { useReviewComments } from '@renderer/features/review/comments'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { useGitFlow } from '@renderer/hooks/use-git-flow'
import { useBranch, useWorktreeInbox } from '@renderer/hooks/use-worktrees'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GlanceHome } from './glance-home'

// Same convention as changes-list/feature-list: mock the domain hooks, never the
// tRPC proxy. Each returns exactly the shape its real query hands back.
vi.mock('@renderer/hooks/use-worktrees', () => ({
  useWorktreeInbox: vi.fn(),
  useBranch: vi.fn(),
}))
vi.mock('@renderer/hooks/use-git-flow', () => ({ useGitFlow: vi.fn() }))
vi.mock('@renderer/hooks/use-feature-reading', () => ({ useFeatureReading: vi.fn() }))
vi.mock('@renderer/features/board', () => ({ useBoardCards: vi.fn() }))
vi.mock('@renderer/features/review/comments', () => ({ useReviewComments: vi.fn() }))

const switchToSpy = vi.fn(async () => {})

const inboxRow: InboxRow = {
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

const reading: FeatureReading = {
  name: 'Glance home',
  sections: [],
  groups: [],
  evidence: null,
}

const card = (over: Partial<BoardCard> & { id: string; title: string }): BoardCard => ({
  status: 'todo',
  order: 0,
  createdAt: 0,
  ...over,
})

/** Reset every mock to a fully empty repo; tests layer their data on top. */
function mockEmpty(): void {
  vi.mocked(useWorktreeInbox).mockReturnValue([])
  vi.mocked(useBranch).mockReturnValue('main')
  vi.mocked(useGitFlow).mockReturnValue({ groups: [], refresh: async () => {} })
  vi.mocked(useFeatureReading).mockReturnValue({ reading: null, refresh: async () => {} })
  vi.mocked(useBoardCards).mockReturnValue({ cards: [], error: null, isLoaded: true })
  vi.mocked(useReviewComments).mockReturnValue([])
}

describe('GlanceHome', () => {
  beforeEach(() => {
    switchToSpy.mockClear()
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useRepoStore.setState({ repo: { path: '/repo', name: 'repo' }, switchTo: switchToSpy })
    usePreferencesStore.setState({ sidebarTab: 'files' })
    mockEmpty()
  })

  it('renders repo name, branch, and always-on Jump to rows', () => {
    render(<GlanceHome />)
    expect(screen.getByText('repo')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('Jump to')).toBeInTheDocument()
    expect(screen.getByTestId('glance-jump-changes')).toBeInTheDocument()
    expect(screen.getByTestId('glance-jump-review')).toBeInTheDocument()
    expect(screen.getByTestId('glance-jump-board')).toBeInTheDocument()
    expect(screen.getByTestId('glance-jump-terminal')).toBeInTheDocument()
  })

  it('renders inbox rows with their changed count, and tapping one switches to that worktree', () => {
    vi.mocked(useWorktreeInbox).mockReturnValue([inboxRow])
    render(<GlanceHome />)
    expect(screen.getByText('Review inbox')).toBeInTheDocument()
    expect(screen.getByLabelText('Review pushed')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    fireEvent.click(screen.getByText('fix-nav'))
    expect(switchToSpy).toHaveBeenCalledWith('/repo-worktrees/fix-nav')
  })

  it('opens All changes for dirty tree and Review for a published set', () => {
    vi.mocked(useGitFlow).mockReturnValue({ groups: flowGroups, refresh: async () => {} })
    vi.mocked(useFeatureReading).mockReturnValue({ reading, refresh: async () => {} })
    render(<GlanceHome />)
    expect(screen.getByText('This checkout')).toBeInTheDocument()
    expect(screen.getByLabelText('Review published')).toBeInTheDocument()
    fireEvent.click(screen.getByText('2 changed files'))
    const paneBefore = useTabsStore.getState().panes[0]
    if (paneBefore === undefined) throw new Error('expected pane 0')
    expect(paneBefore.tabs[0]).toMatchObject({ id: tabId('review', 'working'), kind: 'review' })
    expect(usePreferencesStore.getState().sidebarTab).toBe('changes')
    fireEvent.click(screen.getByText('Glance home'))
    const paneAfter = useTabsStore.getState().panes[0]
    if (paneAfter === undefined) throw new Error('expected pane 0')
    const feature = paneAfter.tabs.find((t) => t.kind === 'feature')
    expect(feature).toMatchObject({ id: tabId('feature', '/repo'), kind: 'feature' })
    expect(usePreferencesStore.getState().sidebarTab).toBe('feature')
  })

  it('renders the board summary with doing titles and tapping opens the board tab', () => {
    vi.mocked(useBoardCards).mockReturnValue({
      cards: [
        card({ id: 'c1', title: 'Ship the Glance', status: 'doing' }),
        card({ id: 'c2', title: 'Later thing' }),
        card({ id: 'c3', title: 'Another later thing' }),
      ],
      error: null,
      isLoaded: true,
    })
    render(<GlanceHome />)
    // Section label + Jump to row both say "Board"; summary also appears twice
    // (Board section + Jump to Board subtitle).
    expect(screen.getAllByText('Board').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('1 doing · 2 to do').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Ship the Glance')).toBeInTheDocument()
    // queued titles are not listed under doing — only doing cards expand
    expect(screen.queryByText('Later thing')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Ship the Glance'))
    const pane = useTabsStore.getState().panes[0]
    if (pane === undefined) throw new Error('expected pane 0')
    expect(pane.tabs[0]).toMatchObject({ id: tabId('board', '/repo'), kind: 'board' })
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

  it('Jump to Terminal focuses the Terminal sidebar tab', () => {
    render(<GlanceHome />)
    fireEvent.click(screen.getByTestId('glance-jump-terminal'))
    expect(usePreferencesStore.getState().sidebarTab).toBe('terminal')
  })
})
