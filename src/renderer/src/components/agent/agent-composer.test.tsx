import { useAgentActions } from '@renderer/hooks/use-agent-channel'
import {
  useAgentCommands,
  useAgentModelFavorites,
  useAgentProviders,
  useToggleAgentModelFavorite,
  useUpdateAgentThread,
} from '@renderer/hooks/use-agents'
import { useFileSearch } from '@renderer/hooks/use-search'
import { useAgentDraftsStore } from '@renderer/stores/agent-drafts'
import type { ProviderStatus, QueuedMessageInfo } from '@shared/agent-protocol'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentComposer } from './agent-composer'

// Repo idiom (see agent-view.test): mock the domain hooks + the channel action surface, never
// tRPC or lib/daemon. The drafts store is REAL — the whole point is that it, not local state,
// carries the message across the composer's unmount.
vi.mock('@renderer/hooks/use-agent-channel', () => ({ useAgentActions: vi.fn() }))
vi.mock('@renderer/hooks/use-agents', () => ({
  useAgentProviders: vi.fn(),
  useUpdateAgentThread: vi.fn(),
  useAgentCommands: vi.fn(),
  useAgentModelFavorites: vi.fn(),
  useToggleAgentModelFavorite: vi.fn(),
}))
vi.mock('@renderer/hooks/use-search', () => ({ useFileSearch: vi.fn() }))

// cmdk (the completion popup) needs a ResizeObserver + scrollIntoView, and Base UI polls
// getAnimations — none exist in jsdom.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub
Element.prototype.scrollIntoView ??= (): void => {}
Element.prototype.getAnimations ??= (): Animation[] => []

const THREAD_ID = 'thread-1'

const claudeProvider: ProviderStatus = {
  provider: 'claude',
  installed: true,
  authenticated: true,
  models: [{ id: 'sonnet', label: 'Sonnet', provider: 'claude' }],
}

const send = vi.fn()
const abort = vi.fn()
const cancelQueued = vi.fn()
const update = vi.fn()

function renderComposer(
  threadId = THREAD_ID,
  overrides: { working?: boolean; queued?: QueuedMessageInfo } = {},
): ReturnType<typeof render> {
  return render(
    <AgentComposer
      threadId={threadId}
      provider="claude"
      model="sonnet"
      resolvedModel={undefined}
      mode="full"
      interaction="build"
      options={undefined}
      working={overrides.working ?? false}
      queued={overrides.queued}
      prefill={null}
      onPrefillConsumed={vi.fn()}
    />,
  )
}

describe('AgentComposer draft persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAgentDraftsStore.setState({ drafts: {} })
    vi.mocked(useAgentActions).mockReturnValue({
      openThread: vi.fn(),
      closeThreadView: vi.fn(),
      send,
      abort,
      cancelQueued,
      approve: vi.fn(),
    })
    vi.mocked(useAgentProviders).mockReturnValue([claudeProvider])
    vi.mocked(useUpdateAgentThread).mockReturnValue({ update })
    vi.mocked(useAgentCommands).mockReturnValue([])
    vi.mocked(useAgentModelFavorites).mockReturnValue([])
    vi.mocked(useToggleAgentModelFavorite).mockReturnValue({ toggle: vi.fn() })
    vi.mocked(useFileSearch).mockReturnValue({ results: [], isFetching: false })
  })

  it('keeps the typed message across the view unmount/remount (the tab-switch bug)', () => {
    const first = renderComposer()
    const input = screen.getByLabelText('Message the agent') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'half a thought' } })

    // Switching viewer tabs unmounts the whole agent view — the draft must not go with it.
    first.unmount()
    renderComposer()

    const reopened = screen.getByLabelText('Message the agent') as HTMLTextAreaElement
    expect(reopened.value).toBe('half a thought')
  })

  it('isolates drafts per thread', () => {
    renderComposer('thread-1')
    fireEvent.change(screen.getByLabelText('Message the agent'), { target: { value: 'for one' } })

    expect(useAgentDraftsStore.getState().drafts['thread-1']?.text).toBe('for one')
    expect(useAgentDraftsStore.getState().drafts['thread-2']).toBeUndefined()
  })

  it('clears the draft on send', () => {
    renderComposer()
    const input = screen.getByLabelText('Message the agent')
    fireEvent.change(input, { target: { value: 'ship it' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(send).toHaveBeenCalledWith(THREAD_ID, { text: 'ship it' })
    expect(useAgentDraftsStore.getState().drafts[THREAD_ID]).toBeUndefined()
  })
})

describe('AgentComposer mid-turn steering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAgentDraftsStore.setState({ drafts: {} })
    vi.mocked(useAgentActions).mockReturnValue({
      openThread: vi.fn(),
      closeThreadView: vi.fn(),
      send,
      abort,
      cancelQueued,
      approve: vi.fn(),
    })
    vi.mocked(useAgentProviders).mockReturnValue([claudeProvider])
    vi.mocked(useUpdateAgentThread).mockReturnValue({ update })
    vi.mocked(useAgentCommands).mockReturnValue([])
    vi.mocked(useAgentModelFavorites).mockReturnValue([])
    vi.mocked(useToggleAgentModelFavorite).mockReturnValue({ toggle: vi.fn() })
    vi.mocked(useFileSearch).mockReturnValue({ results: [], isFetching: false })
  })

  const queuedInfo: QueuedMessageInfo = { text: 'already waiting' }

  it('shows a working Send button that queues the draft without stopping', () => {
    renderComposer(THREAD_ID, { working: true })
    fireEvent.change(screen.getByLabelText('Message the agent'), {
      target: { value: 'steer left' },
    })

    const sendButton = screen.getByLabelText('Send')
    expect(sendButton).not.toBeDisabled()
    fireEvent.click(sendButton)

    expect(send).toHaveBeenCalledWith(THREAD_ID, { text: 'steer left' })
    expect(abort).not.toHaveBeenCalled()
  })

  it('Stop queues the pending draft before aborting (send then abort)', () => {
    renderComposer(THREAD_ID, { working: true })
    fireEvent.change(screen.getByLabelText('Message the agent'), {
      target: { value: 'run this next' },
    })

    fireEvent.click(screen.getByLabelText('Stop'))

    expect(send).toHaveBeenCalledWith(THREAD_ID, { text: 'run this next' })
    expect(abort).toHaveBeenCalledWith(THREAD_ID)
    // Queue-before-abort: the daemon must see the send first on the ordered socket.
    expect(send.mock.invocationCallOrder[0]).toBeLessThan(abort.mock.invocationCallOrder[0])
  })

  it('Stop only aborts when a message is already queued (never clobbers the chip)', () => {
    renderComposer(THREAD_ID, { working: true, queued: queuedInfo })
    fireEvent.change(screen.getByLabelText('Message the agent'), {
      target: { value: 'a newer draft' },
    })

    fireEvent.click(screen.getByLabelText('Stop'))

    expect(send).not.toHaveBeenCalled()
    expect(abort).toHaveBeenCalledWith(THREAD_ID)
  })

  it('Stop only aborts on an empty draft, and Send is disabled', () => {
    renderComposer(THREAD_ID, { working: true })

    expect(screen.getByLabelText('Send')).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Stop'))

    expect(send).not.toHaveBeenCalled()
    expect(abort).toHaveBeenCalledWith(THREAD_ID)
  })
})
