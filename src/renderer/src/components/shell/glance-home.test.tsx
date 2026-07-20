import type { BoardCard } from '@backend/board-store'
import type { FeatureReading } from '@backend/feature-view'
import type { FlowGroup } from '@backend/flow'
import type { InboxRow } from '@backend/worktree-inbox'
import { useAgentThreads } from '@renderer/hooks/use-agents'
import { useBoardCards } from '@renderer/hooks/use-board'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { useGitFlow } from '@renderer/hooks/use-git-flow'
import { useWorktreeInbox } from '@renderer/hooks/use-worktrees'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import type { ThreadInfo } from '@shared/agent-protocol'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GlanceHome } from './glance-home'

// Same convention as changes-list/feature-list: mock the domain hooks, never the
// tRPC proxy. Each returns exactly the shape its real query hands back.
vi.mock('@renderer/hooks/use-agents', () => ({ useAgentThreads: vi.fn() }))
vi.mock('@renderer/hooks/use-worktrees', () => ({ useWorktreeInbox: vi.fn() }))
vi.mock('@renderer/hooks/use-git-flow', () => ({ useGitFlow: vi.fn() }))
vi.mock('@renderer/hooks/use-feature-reading', () => ({ useFeatureReading: vi.fn() }))
vi.mock('@renderer/hooks/use-board', () => ({ useBoardCards: vi.fn() }))

const switchToSpy = vi.fn(async () => {})

const thread = (over: Partial<ThreadInfo> & { id: string; title: string }): ThreadInfo => ({
  repoPath: '/repo',
  provider: 'claude',
  model: 'sonnet',
  mode: 'full',
  status: 'idle',
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const inboxRow: InboxRow = {
  path: '/repo-worktrees/fix-nav',
  branch: 'fix-nav',
  changedCount: 4,
  workingThreads: 0,
  idleThreads: 1,
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
  vi.mocked(useAgentThreads).mockReturnValue([])
  vi.mocked(useWorktreeInbox).mockReturnValue([])
  vi.mocked(useGitFlow).mockReturnValue({ groups: [], refresh: async () => {} })
  vi.mocked(useFeatureReading).mockReturnValue({ reading: null, refresh: async () => {} })
  vi.mocked(useBoardCards).mockReturnValue({ cards: [], error: null })
}

describe('GlanceHome', () => {
  beforeEach(() => {
    switchToSpy.mockClear()
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useRepoStore.setState({ repo: { path: '/repo', name: 'repo' }, switchTo: switchToSpy })
    mockEmpty()
  })

  it('renders thread rows with their status', () => {
    vi.mocked(useAgentThreads).mockReturnValue([
      thread({ id: 't1', title: 'Fix the nav', status: 'working' }),
      thread({ id: 't2', title: 'Polish copy', worktreeBranch: 'copy-pass' }),
    ])
    render(<GlanceHome />)
    expect(screen.getByText('repo')).toBeInTheDocument()
    expect(screen.getByText('Agent threads')).toBeInTheDocument()
    expect(screen.getByText('Fix the nav')).toBeInTheDocument()
    expect(screen.getByText('Polish copy')).toBeInTheDocument()
    // working → spinner; idle stays quiet (exactly one spinner across both rows)
    expect(screen.getAllByLabelText('Working')).toHaveLength(1)
    // the worktree chip on the bound thread
    expect(screen.getByText('copy-pass')).toBeInTheDocument()
  })

  it('renders inbox rows and tapping one switches to that worktree', () => {
    vi.mocked(useWorktreeInbox).mockReturnValue([inboxRow])
    render(<GlanceHome />)
    expect(screen.getByText('Review inbox')).toBeInTheDocument()
    expect(screen.getByLabelText('Review pushed')).toBeInTheDocument()
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
    let { tabs } = useTabsStore.getState().panes[0]
    expect(tabs[0]).toMatchObject({ id: tabId('review', 'working'), kind: 'review' })
    fireEvent.click(screen.getByText('Glance home'))
    tabs = useTabsStore.getState().panes[0].tabs
    const feature = tabs.find((t) => t.kind === 'feature')
    expect(feature).toMatchObject({ id: tabId('feature', '/repo'), kind: 'feature' })
  })

  it('renders the board summary with doing titles and tapping opens the board tab', () => {
    vi.mocked(useBoardCards).mockReturnValue({
      cards: [
        card({ id: 'c1', title: 'Ship the Glance', status: 'doing' }),
        card({ id: 'c2', title: 'Later thing' }),
        card({ id: 'c3', title: 'Another later thing' }),
      ],
      error: null,
    })
    render(<GlanceHome />)
    expect(screen.getByText('Board')).toBeInTheDocument()
    expect(screen.getByText('1 doing · 2 to do')).toBeInTheDocument()
    expect(screen.getByText('Ship the Glance')).toBeInTheDocument()
    // queued titles are not listed — only doing
    expect(screen.queryByText('Later thing')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('1 doing · 2 to do'))
    const { tabs } = useTabsStore.getState().panes[0]
    expect(tabs[0]).toMatchObject({ id: tabId('board', '/repo'), kind: 'board' })
  })

  it('shows one quiet line when everything is empty', () => {
    render(<GlanceHome />)
    expect(screen.getByText('Nothing in flight')).toBeInTheDocument()
    expect(screen.queryByText('Agent threads')).not.toBeInTheDocument()
    expect(screen.queryByText('This checkout')).not.toBeInTheDocument()
  })

  it('tapping a thread opens its agent tab', () => {
    vi.mocked(useAgentThreads).mockReturnValue([thread({ id: 't1', title: 'Fix the nav' })])
    render(<GlanceHome />)
    fireEvent.click(screen.getByText('Fix the nav'))
    const { tabs } = useTabsStore.getState().panes[0]
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ id: tabId('agent', 't1'), kind: 'agent', path: 't1' })
  })
})
