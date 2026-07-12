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
import type { ProviderStatus } from '@shared/agent-protocol'
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

function renderComposer(threadId = THREAD_ID): ReturnType<typeof render> {
  return render(
    <AgentComposer
      threadId={threadId}
      provider="claude"
      model="sonnet"
      resolvedModel={undefined}
      mode="full"
      interaction="build"
      options={undefined}
      working={false}
      queued={undefined}
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
