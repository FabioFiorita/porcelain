import { useAgentLimits, useAgentThreads } from '@renderer/hooks/use-agents'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import type { AgentUsage, ThreadInfo, TimelineItem } from '@shared/agent-protocol'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AgentsQuickAccess,
  formatCostUsd,
  formatResetIn,
  formatTokenCount,
} from './agents-quick-access'

// Repo idiom: mock the domain hooks, never tRPC. The stores are real — we seed the
// tabs store (the active-tab resolution) and the agent-threads store (the timelines).
vi.mock('@renderer/hooks/use-agents', () => ({
  useAgentThreads: vi.fn(),
  useAgentLimits: vi.fn(),
}))

function makeThread(
  id: string,
  status: 'idle' | 'working',
  updatedAt: number,
  usage?: AgentUsage,
): ThreadInfo {
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
    ...(usage ? { usage } : {}),
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
    vi.mocked(useAgentLimits).mockReturnValue(null)
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

  it('renders the token-usage line with compact last-turn + total counts', () => {
    vi.mocked(useAgentThreads).mockReturnValue([
      makeThread('t1', 'idle', 1, {
        turnInput: 1200,
        turnOutput: 340,
        totalInput: 45000,
        totalOutput: 12000,
      }),
    ])
    activateAgentTab('t1')

    render(<AgentsQuickAccess />)
    expect(screen.getByText('Usage')).toBeInTheDocument()
    expect(
      screen.getByText('Last turn 1.2k in · 340 out — total 45k in · 12k out'),
    ).toBeInTheDocument()
  })

  it('hides the usage line when the thread has no usage yet', () => {
    vi.mocked(useAgentThreads).mockReturnValue([makeThread('t1', 'idle', 1)])
    activateAgentTab('t1')
    seedThread('t1', [{ kind: 'assistant', id: 'a1', text: 'done', streaming: false }])

    render(<AgentsQuickAccess />)
    expect(screen.queryByText('Usage')).toBeNull()
  })

  it('appends the notional session cost to the usage line when present', () => {
    vi.mocked(useAgentThreads).mockReturnValue([
      makeThread('t1', 'idle', 1, {
        turnInput: 1200,
        turnOutput: 340,
        totalInput: 45000,
        totalOutput: 12000,
        totalCostUsd: 0.42,
      }),
    ])
    activateAgentTab('t1')

    render(<AgentsQuickAccess />)
    expect(screen.getByText(/\$0\.42 est\./)).toBeInTheDocument()
  })

  it('renders the Limits group with a bar, percent, and relative reset per window', () => {
    const resetsAt = Date.now() + 3 * 3_600_000 + 25 * 60_000 + 30_000
    vi.mocked(useAgentThreads).mockReturnValue([makeThread('t1', 'idle', 1)])
    vi.mocked(useAgentLimits).mockReturnValue({
      windows: [{ id: '5h', label: '5-hour', usedPercent: 42, resetsAt }],
    })
    activateAgentTab('t1')

    render(<AgentsQuickAccess />)
    expect(screen.getByText('Limits')).toBeInTheDocument()
    expect(screen.getByText('5-hour')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(screen.getByText('resets in 3h 25m')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
  })

  it('hides the Limits group when the provider returns null limits', () => {
    vi.mocked(useAgentThreads).mockReturnValue([makeThread('t1', 'idle', 1)])
    vi.mocked(useAgentLimits).mockReturnValue(null)
    activateAgentTab('t1')
    seedThread('t1', [{ kind: 'assistant', id: 'a1', text: 'done', streaming: false }])

    render(<AgentsQuickAccess />)
    expect(screen.queryByText('Limits')).toBeNull()
  })
})

describe('formatCostUsd', () => {
  it('formats a dollar figure to two decimals', () => {
    expect(formatCostUsd(0.42)).toBe('$0.42')
    expect(formatCostUsd(12.5)).toBe('$12.50')
    expect(formatCostUsd(0)).toBe('$0.00')
  })
})

describe('formatResetIn', () => {
  const now = 1_000_000_000_000
  it('formats hours and minutes, dropping a zero component', () => {
    expect(formatResetIn(now + 3 * 3_600_000 + 25 * 60_000, now)).toBe('resets in 3h 25m')
    expect(formatResetIn(now + 3 * 3_600_000, now)).toBe('resets in 3h')
    expect(formatResetIn(now + 42 * 60_000, now)).toBe('resets in 42m')
  })

  it('reads "resets soon" for a sub-minute or past reset', () => {
    expect(formatResetIn(now + 30_000, now)).toBe('resets soon')
    expect(formatResetIn(now - 60_000, now)).toBe('resets soon')
  })
})

describe('formatTokenCount', () => {
  it('formats counts compactly with k/M suffixes', () => {
    expect(formatTokenCount(340)).toBe('340')
    expect(formatTokenCount(1200)).toBe('1.2k')
    expect(formatTokenCount(45000)).toBe('45k')
    expect(formatTokenCount(12000)).toBe('12k')
    expect(formatTokenCount(1_500_000)).toBe('1.5M')
  })
})
