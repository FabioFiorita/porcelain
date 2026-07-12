import { useAgentThreads } from '@renderer/hooks/use-agents'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import type { ThreadInfo, TimelineItem } from '@shared/agent-protocol'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentsQuickAccess } from './agents-quick-access'

// Repo idiom: mock the domain hooks, never tRPC. The stores are real — we seed the
// tabs store (the active-tab resolution) and the agent-threads store (the timelines).
vi.mock('@renderer/hooks/use-agents', () => ({ useAgentThreads: vi.fn() }))

function makeThread(id: string, status: 'idle' | 'working', updatedAt: number): ThreadInfo {
  return {
    id,
    repoPath: '/repo',
    title: id,
    provider: 'claude',
    model: 'sonnet',
    mode: 'full',
    status,
    createdAt: 0,
    updatedAt,
  }
}

const planItem: TimelineItem = {
  kind: 'plan',
  id: 'plan',
  steps: [
    { text: 'Survey the code', status: 'done' },
    { text: 'Apply the edit', status: 'active' },
  ],
}

function seedThread(threadId: string, items: TimelineItem[]): void {
  useAgentThreadsStore.setState((state) => ({
    threads: { ...state.threads, [threadId]: { items, status: 'idle', attached: true } },
  }))
}

function activateAgentTab(threadId: string): void {
  const tab = {
    id: tabId('agent', threadId),
    kind: 'agent' as const,
    title: threadId,
    path: threadId,
  }
  useTabsStore.setState({ panes: [{ tabs: [tab], activeTabId: tab.id }], activePaneIndex: 0 })
}

describe('AgentsQuickAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAgentThreadsStore.setState({ threads: {} })
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    vi.mocked(useAgentThreads).mockReturnValue([])
  })

  it('shows the active agent tab thread plan with its progress line', () => {
    vi.mocked(useAgentThreads).mockReturnValue([makeThread('t1', 'idle', 1)])
    activateAgentTab('t1')
    seedThread('t1', [planItem])

    render(<AgentsQuickAccess />)
    expect(screen.getByText('Plan')).toBeInTheDocument()
    expect(screen.getByText('Survey the code')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
  })

  it('prefers the active agent tab thread over a busier working thread', () => {
    vi.mocked(useAgentThreads).mockReturnValue([
      makeThread('t1', 'idle', 1),
      makeThread('t2', 'working', 99),
    ])
    activateAgentTab('t1')
    seedThread('t1', [planItem])
    seedThread('t2', [
      { kind: 'plan', id: 'plan', steps: [{ text: 'Other thread step', status: 'pending' }] },
    ])

    render(<AgentsQuickAccess />)
    expect(screen.getByText('Survey the code')).toBeInTheDocument()
    expect(screen.queryByText('Other thread step')).toBeNull()
  })

  it('falls back to the most recently updated working thread without an agent tab', () => {
    vi.mocked(useAgentThreads).mockReturnValue([
      makeThread('t1', 'working', 5),
      makeThread('t2', 'working', 9),
    ])
    seedThread('t2', [planItem])

    render(<AgentsQuickAccess />)
    expect(screen.getByText('Survey the code')).toBeInTheDocument()
  })

  it('lists only still-running tools in the Running group', () => {
    vi.mocked(useAgentThreads).mockReturnValue([makeThread('t1', 'working', 1)])
    activateAgentTab('t1')
    seedThread('t1', [
      { kind: 'tool', id: 'tool-1', title: 'Bash', detail: 'pnpm test', status: 'running' },
      { kind: 'tool', id: 'tool-2', title: 'Read', detail: 'file.ts', status: 'ok' },
    ])

    render(<AgentsQuickAccess />)
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Bash')).toBeInTheDocument()
    expect(screen.getByText('pnpm test')).toBeInTheDocument()
    expect(screen.queryByText('Read')).toBeNull()
  })

  it('renders nothing when there is no plan and nothing running', () => {
    vi.mocked(useAgentThreads).mockReturnValue([makeThread('t1', 'idle', 1)])
    activateAgentTab('t1')
    seedThread('t1', [{ kind: 'assistant', id: 'a1', text: 'done', streaming: false }])

    const { container } = render(<AgentsQuickAccess />)
    expect(container).toBeEmptyDOMElement()
  })
})
