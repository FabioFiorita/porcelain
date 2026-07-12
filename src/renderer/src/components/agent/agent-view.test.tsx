import { useAgentActions } from '@renderer/hooks/use-agent-channel'
import {
  useAgentModelFavorites,
  useAgentProviders,
  useAgentThreads,
  useToggleAgentModelFavorite,
  useUpdateAgentThread,
} from '@renderer/hooks/use-agents'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import type { ProviderStatus, ThreadInfo, TimelineItem } from '@shared/agent-protocol'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentView } from './agent-view'

// Repo idiom (see changes-list.test): mock the domain hooks + the channel action
// surface, never tRPC or lib/daemon. The store is real — we seed the live timeline
// through it, exactly as an attach snapshot would.
vi.mock('@renderer/hooks/use-agent-channel', () => ({ useAgentActions: vi.fn() }))
vi.mock('@renderer/hooks/use-agents', () => ({
  useAgentThreads: vi.fn(),
  useAgentProviders: vi.fn(),
  useUpdateAgentThread: vi.fn(),
  useAgentModelFavorites: vi.fn(),
  useToggleAgentModelFavorite: vi.fn(),
}))

const THREAD_ID = 'thread-1'

const thread: ThreadInfo = {
  id: THREAD_ID,
  repoPath: '/repo',
  title: 'My thread',
  provider: 'claude',
  model: 'sonnet',
  mode: 'full',
  status: 'idle',
  createdAt: 0,
  updatedAt: 0,
}

const claudeProvider: ProviderStatus = {
  provider: 'claude',
  installed: true,
  authenticated: true,
  models: [
    {
      id: 'sonnet',
      label: 'Sonnet',
      provider: 'claude',
      efforts: { values: ['low', 'high', 'xhigh'], default: 'high' },
      contextWindows: { values: ['200k', '1m'], default: '200k' },
    },
  ],
}

const openThread = vi.fn()
const closeThreadView = vi.fn()
const send = vi.fn()
const abort = vi.fn()
const approve = vi.fn()
const update = vi.fn()

function seed(items: TimelineItem[], status: 'idle' | 'working' = 'idle'): void {
  useAgentThreadsStore.setState({ threads: { [THREAD_ID]: { items, status, attached: true } } })
}

describe('AgentView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAgentThreadsStore.setState({ threads: {} })
    vi.mocked(useAgentActions).mockReturnValue({
      openThread,
      closeThreadView,
      send,
      abort,
      approve,
    })
    vi.mocked(useAgentThreads).mockReturnValue([thread])
    vi.mocked(useAgentProviders).mockReturnValue([claudeProvider])
    vi.mocked(useUpdateAgentThread).mockReturnValue({ update })
    vi.mocked(useAgentModelFavorites).mockReturnValue([])
    vi.mocked(useToggleAgentModelFavorite).mockReturnValue({ toggle: vi.fn() })
  })

  it('renders a user bubble with its image-count badge', () => {
    seed([{ kind: 'user', id: 'u1', text: 'hello agent', imageCount: 2 }])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText('hello agent')).toBeInTheDocument()
    expect(screen.getByText('2 images')).toBeInTheDocument()
  })

  it('renders assistant markdown text', () => {
    seed([{ kind: 'assistant', id: 'a1', text: 'a **bold** reply', streaming: false }])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText('bold')).toBeInTheDocument()
  })

  it('renders reasoning collapsed with a Thinking… lead-in', () => {
    seed([{ kind: 'reasoning', id: 'r1', text: 'first thought\nsecond', streaming: true }])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText(/Thinking…/)).toBeInTheDocument()
    expect(screen.getByText(/first thought/)).toBeInTheDocument()
  })

  it('renders a tool one-liner and reveals its output on expand', () => {
    seed([
      { kind: 'tool', id: 't1', title: 'Bash', detail: 'ls -la', status: 'ok', output: 'file.txt' },
    ])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText('Bash')).toBeInTheDocument()
    expect(screen.queryByText('file.txt')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Bash'))
    expect(screen.getByText('file.txt')).toBeInTheDocument()
  })

  it('renders an error row', () => {
    seed([{ kind: 'error', id: 'e1', message: 'turn failed' }])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText('turn failed')).toBeInTheDocument()
  })

  it('a pending approval calls approve with the decision when a button is clicked', () => {
    seed([
      { kind: 'approval', id: 'ap1', requestId: 'req-9', title: 'Run command?', status: 'pending' },
    ])
    render(<AgentView threadId={THREAD_ID} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept for session' }))
    expect(approve).toHaveBeenCalledWith(THREAD_ID, 'req-9', 'accept-session')
  })

  it('a resolved approval disables its buttons and shows the resolved badge', () => {
    seed([
      {
        kind: 'approval',
        id: 'ap1',
        requestId: 'req-9',
        title: 'Run command?',
        status: 'accepted',
      },
    ])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled()
    expect(screen.getByText('Accepted')).toBeInTheDocument()
  })

  it('shows the "Working for" indicator while the thread is working', () => {
    seed([{ kind: 'assistant', id: 'a1', text: 'thinking', streaming: true }], 'working')
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText(/Working for/)).toBeInTheDocument()
    // The send button becomes Stop → abort while working.
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(abort).toHaveBeenCalledWith(THREAD_ID)
  })

  it('renders the plan card with its done counter and step statuses', () => {
    seed([
      {
        kind: 'plan',
        id: 'plan',
        steps: [
          { text: 'Read the files', status: 'done' },
          { text: 'Write the change', status: 'active' },
          { text: 'Run the tests', status: 'pending' },
        ],
      },
    ])
    render(<AgentView threadId={THREAD_ID} />)
    // The composer's Plan toggle also says "Plan" — scope to the card's span header.
    expect(screen.getByText('Plan', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('1/3 done')).toBeInTheDocument()
    expect(screen.getByText('Read the files')).toBeInTheDocument()
    expect(screen.getByText('Write the change')).toBeInTheDocument()
    expect(screen.getByText('Run the tests')).toBeInTheDocument()
  })

  it('the options chip shows the model defaults and persists a picked effort', async () => {
    seed([])
    render(<AgentView threadId={THREAD_ID} />)
    const chip = screen.getByRole('button', { name: 'Model options' })
    expect(chip).toHaveTextContent('High · 200k')

    fireEvent.click(chip)
    expect(await screen.findByText('Reasoning')).toBeInTheDocument()
    expect(screen.getByText('Context Window')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Extra High/ }))
    expect(update).toHaveBeenCalledWith(THREAD_ID, { options: { effort: 'xhigh' } })
  })

  it('the options chip renders only the sections the model supports', () => {
    vi.mocked(useAgentProviders).mockReturnValue([
      {
        ...claudeProvider,
        models: [
          {
            id: 'sonnet',
            label: 'Sonnet',
            provider: 'claude',
            efforts: { values: ['low', 'high'], default: 'high' },
          },
        ],
      },
    ])
    seed([])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByRole('button', { name: 'Model options' })).toHaveTextContent(/^High$/)
  })

  it('the options chip renders nothing for a model with neither control', () => {
    vi.mocked(useAgentProviders).mockReturnValue([
      { ...claudeProvider, models: [{ id: 'sonnet', label: 'Sonnet', provider: 'claude' }] },
    ])
    seed([])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.queryByRole('button', { name: 'Model options' })).toBeNull()
  })

  it('Shift+Tab in the message field flips Build to Plan (and back)', () => {
    seed([])
    render(<AgentView threadId={THREAD_ID} />)
    const input = screen.getByLabelText('Message the agent')

    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
    expect(update).toHaveBeenCalledWith(THREAD_ID, { interaction: 'plan' })

    vi.mocked(useAgentThreads).mockReturnValue([{ ...thread, interaction: 'plan' }])
    render(<AgentView threadId={THREAD_ID} />)
    const inputs = screen.getAllByLabelText('Message the agent')
    fireEvent.keyDown(inputs[1], { key: 'Tab', shiftKey: true })
    expect(update).toHaveBeenLastCalledWith(THREAD_ID, { interaction: 'build' })
  })

  it('Enter sends the composed message; Shift+Enter does not', () => {
    seed([])
    render(<AgentView threadId={THREAD_ID} />)
    const input = screen.getByLabelText('Message the agent')

    fireEvent.change(input, { target: { value: 'draft still typing' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(send).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'ship it' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(send).toHaveBeenCalledWith(THREAD_ID, { text: 'ship it' })
  })
})
