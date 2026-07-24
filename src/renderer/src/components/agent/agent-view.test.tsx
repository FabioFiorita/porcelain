import { useAgentActions } from '@renderer/hooks/use-agent-channel'
import {
  useAgentCommands,
  useAgentModelFavorites,
  useAgentProviders,
  useAgentThreads,
  useToggleAgentModelFavorite,
  useUpdateAgentThread,
} from '@renderer/hooks/use-agents'
import { useReadFile } from '@renderer/hooks/use-files'
import { useFileSearch } from '@renderer/hooks/use-search'
import { copyText } from '@renderer/lib/utils'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import type { ProviderStatus, ThreadInfo, TimelineItem } from '@shared/agent-protocol'
import { TOOL_OUTPUT_CAP } from '@shared/agent-protocol'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentView, groupTimelineItems } from './agent-view'

vi.mock('@renderer/hooks/use-remote-daemon', () => ({
  useActiveRemoteEnvironment: () => null,
  useRemoteEnvironments: () => undefined,
}))
vi.mock('@renderer/hooks/use-git-flow', () => ({
  useGitFlow: () => ({ groups: [] }),
}))
vi.mock('@renderer/hooks/use-feature-reading', () => ({
  useFeatureReading: () => ({ reading: null, refresh: async () => {} }),
}))
// Local markdown images resolve through readFile → data URL (CSP blocks path srcs).
vi.mock('@renderer/hooks/use-files', () => ({ useReadFile: vi.fn() }))

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
  useAgentCommands: vi.fn(),
}))
// The composer's autocomplete rides the file finder's exact search source.
vi.mock('@renderer/hooks/use-search', () => ({ useFileSearch: vi.fn() }))
// Keep cn() real (layout depends on it); only stub copyText so the copy affordances don't hit
// the insecure-context execCommand fallback under jsdom.
vi.mock('@renderer/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@renderer/lib/utils')>()),
  copyText: vi.fn(),
}))

// cmdk (the completion popup's list) needs a ResizeObserver and scrolls the active row
// into view — neither exists in jsdom, so stub them for the popup's mount.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub
Element.prototype.scrollIntoView ??= (): void => {}
// Base UI's ScrollArea (inside menus/popups) polls getAnimations on a timer; jsdom has none.
Element.prototype.getAnimations ??= (): Animation[] => []

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
const cancelQueued = vi.fn()
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
      cancelQueued,
      approve,
    })
    vi.mocked(useAgentThreads).mockReturnValue([thread])
    vi.mocked(useAgentProviders).mockReturnValue([claudeProvider])
    vi.mocked(useUpdateAgentThread).mockReturnValue({ update })
    vi.mocked(useAgentModelFavorites).mockReturnValue([])
    vi.mocked(useToggleAgentModelFavorite).mockReturnValue({ toggle: vi.fn() })
    vi.mocked(useAgentCommands).mockReturnValue([])
    vi.mocked(useFileSearch).mockReturnValue({ results: [], isFetching: false })
    vi.mocked(useReadFile).mockReturnValue({ view: undefined, error: null })
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

  it('renders a local markdown image via the daemon data URL', () => {
    vi.mocked(useReadFile).mockReturnValue({
      view: { type: 'image', dataUrl: 'data:image/png;base64,AAAA' },
      error: null,
    })
    seed([
      {
        kind: 'assistant',
        id: 'a1',
        text: 'Shot:\n\n![Board Focus default](/tmp/board-focus-shot/default.png)',
        streaming: false,
      },
    ])
    render(<AgentView threadId={THREAD_ID} />)
    const img = screen.getByRole('img', { name: 'Board Focus default' })
    expect(img).toHaveAttribute('src', 'data:image/png;base64,AAAA')
    expect(useReadFile).toHaveBeenCalledWith('/tmp/board-focus-shot/default.png', true)
  })

  it('falls back to a chip when a local markdown image is missing', () => {
    vi.mocked(useReadFile).mockReturnValue({ view: { type: 'not-found' }, error: null })
    seed([
      {
        kind: 'assistant',
        id: 'a1',
        text: '![Gone shot](/tmp/missing.png)',
        streaming: false,
      },
    ])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText('Gone shot')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Gone shot' })).not.toBeInTheDocument()
  })

  it('renders reasoning collapsed with a Thinking… lead-in', () => {
    seed([{ kind: 'reasoning', id: 'r1', text: 'first thought\nsecond', streaming: true }])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText(/Thinking…/)).toBeInTheDocument()
    expect(screen.getByText(/first thought/)).toBeInTheDocument()
  })

  it('hides completed reasoning with empty text (redacted thoughts)', () => {
    seed([{ kind: 'reasoning', id: 'r1', text: '', streaming: false }])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.queryByText(/Thought/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Thinking/)).not.toBeInTheDocument()
  })

  it('expands reasoning to show the full thought body', () => {
    seed([{ kind: 'reasoning', id: 'r1', text: 'line one\nline two', streaming: false }])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText(/Thought/)).toBeInTheDocument()
    expect(screen.queryByText(/line two/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/Thought/))
    expect(screen.getByText(/line two/)).toBeInTheDocument()
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

  it('collapses consecutive tools into one summary row', () => {
    seed([
      { kind: 'tool', id: 't1', title: 'Read', detail: 'a.ts', status: 'ok' },
      { kind: 'tool', id: 't2', title: 'Edit', detail: 'a.ts', status: 'ok' },
      { kind: 'tool', id: 't3', title: 'Bash', detail: 'pnpm test', status: 'ok' },
    ])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText(/3 tools/)).toBeInTheDocument()
    // Individual tools stay collapsed until the group expands.
    expect(screen.queryByText('pnpm test')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/3 tools/))
    expect(screen.getByText('pnpm test')).toBeInTheDocument()
  })

  it('renders stacked queue as Up next after the turn, not as user bubbles', () => {
    vi.mocked(useAgentThreads).mockReturnValue([
      {
        ...thread,
        status: 'working',
        queued: [
          { id: 'q1', text: 'first pending' },
          { id: 'q2', text: 'second pending' },
        ],
      },
    ])
    seed([{ kind: 'assistant', id: 'a1', text: 'still working', streaming: true }], 'working')
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText(/Up next/)).toBeInTheDocument()
    expect(screen.getByText('first pending')).toBeInTheDocument()
    expect(screen.getByText('second pending')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Cancel queued message 2'))
    expect(cancelQueued).toHaveBeenCalledWith(THREAD_ID, 1)
  })

  it('copies an assistant message via copyText', () => {
    seed([{ kind: 'assistant', id: 'a1', text: 'copy me', streaming: false }])
    render(<AgentView threadId={THREAD_ID} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(copyText).toHaveBeenCalledWith('copy me')
  })

  it('flags tool output that hit the truncation cap', () => {
    const capped = 'x'.repeat(TOOL_OUTPUT_CAP)
    seed([{ kind: 'tool', id: 't1', title: 'Bash', status: 'ok', output: capped }])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.queryByText('output truncated')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Bash'))
    expect(screen.getByText('output truncated')).toBeInTheDocument()
  })

  it('the empty timeline offers starter prompts that drop into the composer', () => {
    seed([])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText('Claude Code')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Plan a fix for the bug I’m seeing — don’t edit yet.'))
    const input = screen.getByLabelText('Message the agent') as HTMLTextAreaElement
    expect(input.value).toBe('Plan a fix for the bug I’m seeing — don’t edit yet.')
  })

  it('shows a session strip with model and idle/working status', () => {
    seed([{ kind: 'assistant', id: 'a1', text: 'hi', streaming: false }])
    render(<AgentView threadId={THREAD_ID} />)
    // Strip + composer both label the model — assert Idle (strip-only) for orientation.
    expect(screen.getAllByText('Sonnet').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Idle')).toBeInTheDocument()
  })

  it('shows a turn usage footer after an idle assistant reply when usage is known', () => {
    vi.mocked(useAgentThreads).mockReturnValue([
      {
        ...thread,
        usage: {
          turnInput: 45_002,
          turnOutput: 18,
          totalInput: 45_002,
          totalOutput: 18,
          turnCacheRead: 45_000,
          totalCostUsd: 0.56,
        },
      },
    ])
    seed([{ kind: 'assistant', id: 'a1', text: 'hi', streaming: false }])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText('45k in (45k cached) · 18 out')).toBeInTheDocument()
    expect(screen.getByText(/\$0\.56 est\./)).toBeInTheDocument()
  })

  it('Enter approves and Escape declines the pending approval, but not while typing', () => {
    seed([
      { kind: 'approval', id: 'ap1', requestId: 'req-9', title: 'Run command?', status: 'pending' },
    ])
    render(<AgentView threadId={THREAD_ID} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(approve).toHaveBeenLastCalledWith(THREAD_ID, 'req-9', 'accept')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(approve).toHaveBeenLastCalledWith(THREAD_ID, 'req-9', 'decline')
    // Typing in the composer must not trigger a decision.
    approve.mockClear()
    fireEvent.keyDown(screen.getByLabelText('Message the agent'), { key: 'Enter' })
    expect(approve).not.toHaveBeenCalled()
  })

  it('renders an error row', () => {
    seed([{ kind: 'error', id: 'e1', message: 'turn failed' }])
    render(<AgentView threadId={THREAD_ID} />)
    expect(screen.getByText('turn failed')).toBeInTheDocument()
  })

  it('groupTimelineItems collapses consecutive tools and leaves singles alone', () => {
    const rows = groupTimelineItems([
      { kind: 'user', id: 'u1', text: 'go' },
      { kind: 'tool', id: 't1', title: 'Read', status: 'ok' },
      { kind: 'tool', id: 't2', title: 'Edit', status: 'ok' },
      { kind: 'assistant', id: 'a1', text: 'done', streaming: false },
      { kind: 'tool', id: 't3', title: 'Bash', status: 'ok' },
    ])
    expect(rows.map((r) => r.kind)).toEqual(['single', 'tools', 'single', 'single'])
    expect(rows[1]?.kind === 'tools' && rows[1].tools).toHaveLength(2)
  })

  it('groupTimelineItems never folds Task (subagent) into a tools chip', () => {
    const rows = groupTimelineItems([
      { kind: 'tool', id: 'task1', title: 'Task', detail: 'Review push', status: 'ok' },
      { kind: 'tool', id: 't1', title: 'Read', status: 'ok' },
      { kind: 'tool', id: 't2', title: 'Bash', status: 'ok' },
      { kind: 'tool', id: 'task2', title: 'Task', detail: 'Other agent', status: 'running' },
    ])
    expect(rows.map((r) => r.kind)).toEqual(['single', 'tools', 'single'])
    expect(rows[0]?.kind === 'single' && rows[0].item.kind === 'tool' && rows[0].item.title).toBe(
      'Task',
    )
    expect(rows[1]?.kind === 'tools' && rows[1].tools).toHaveLength(2)
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

  it('typing an @-token opens the file mention popup; selecting inserts the path + a space', () => {
    vi.mocked(useFileSearch).mockReturnValue({
      results: [{ path: 'src/queue.ts', kind: 'file' }],
      isFetching: false,
    })
    seed([])
    render(<AgentView threadId={THREAD_ID} />)
    const input = screen.getByLabelText('Message the agent')

    fireEvent.change(input, { target: { value: '@que' } })
    expect(screen.getByText('queue.ts')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect((input as HTMLTextAreaElement).value).toBe('@src/queue.ts ')
    // A mention Enter completes — it must not send the message.
    expect(send).not.toHaveBeenCalled()
  })

  it('a leading slash lists the provider commands; selecting inserts /name + a space', () => {
    vi.mocked(useAgentCommands).mockReturnValue([
      { name: 'commit', description: 'Commit staged changes' },
    ])
    seed([])
    render(<AgentView threadId={THREAD_ID} />)
    const input = screen.getByLabelText('Message the agent')

    fireEvent.change(input, { target: { value: '/comm' } })
    expect(screen.getByText('Commit staged changes')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect((input as HTMLTextAreaElement).value).toBe('/commit ')
  })

  it('Enter does not send while the completion popup is open', () => {
    vi.mocked(useFileSearch).mockReturnValue({
      results: [{ path: 'src/queue.ts', kind: 'file' }],
      isFetching: false,
    })
    seed([])
    render(<AgentView threadId={THREAD_ID} />)
    const input = screen.getByLabelText('Message the agent')

    fireEvent.change(input, { target: { value: '@que' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(send).not.toHaveBeenCalled()
  })
})
