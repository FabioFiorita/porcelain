import type { AgentEvent, TimelineItem } from '@shared/agent-protocol'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAgentThreadsStore } from './agent-threads'

const userItem: TimelineItem = { kind: 'user', id: 'u1', text: 'hello' }
const assistantItem: TimelineItem = { kind: 'assistant', id: 'a1', text: 'hi', streaming: true }

describe('useAgentThreadsStore', () => {
  beforeEach(() => {
    useAgentThreadsStore.setState({ threads: {} })
  })

  it('applySnapshot seeds items + status and marks attached', () => {
    useAgentThreadsStore.getState().applySnapshot('t1', [userItem], 'working')
    expect(useAgentThreadsStore.getState().threads.t1).toEqual({
      items: [userItem],
      status: 'working',
      attached: true,
    })
  })

  it('applyEvent upserts a timeline item via the shared reducer', () => {
    useAgentThreadsStore.getState().applySnapshot('t1', [], 'idle')
    const event: AgentEvent = { t: 'item', item: assistantItem }
    useAgentThreadsStore.getState().applyEvent('t1', event)
    expect(useAgentThreadsStore.getState().threads.t1.items).toEqual([assistantItem])
  })

  it('applyEvent appends a delta to an open assistant item', () => {
    useAgentThreadsStore.getState().applySnapshot('t1', [assistantItem], 'working')
    useAgentThreadsStore.getState().applyEvent('t1', { t: 'item-delta', id: 'a1', delta: ' there' })
    const [item] = useAgentThreadsStore.getState().threads.t1.items
    expect(item).toMatchObject({ kind: 'assistant', text: 'hi there', streaming: true })
  })

  it('applyEvent status updates run state without touching items', () => {
    useAgentThreadsStore.getState().applySnapshot('t1', [userItem], 'working')
    useAgentThreadsStore.getState().applyEvent('t1', { t: 'status', status: 'idle' })
    expect(useAgentThreadsStore.getState().threads.t1.status).toBe('idle')
    expect(useAgentThreadsStore.getState().threads.t1.items).toEqual([userItem])
  })

  it('applyEvent on an unseen thread starts from an empty timeline', () => {
    useAgentThreadsStore.getState().applyEvent('t2', { t: 'item', item: userItem })
    expect(useAgentThreadsStore.getState().threads.t2).toEqual({
      items: [userItem],
      status: 'idle',
      attached: true,
    })
  })

  it('markDetached flips attached but keeps the items', () => {
    useAgentThreadsStore.getState().applySnapshot('t1', [userItem], 'idle')
    useAgentThreadsStore.getState().markDetached('t1')
    expect(useAgentThreadsStore.getState().threads.t1).toEqual({
      items: [userItem],
      status: 'idle',
      attached: false,
    })
  })

  it('markDetached no-ops on an unknown thread', () => {
    useAgentThreadsStore.getState().markDetached('nope')
    expect(useAgentThreadsStore.getState().threads).toEqual({})
  })

  it('remove drops a thread entry', () => {
    useAgentThreadsStore.getState().applySnapshot('t1', [userItem], 'idle')
    useAgentThreadsStore.getState().remove('t1')
    expect(useAgentThreadsStore.getState().threads.t1).toBeUndefined()
  })

  it('reset clears every thread', () => {
    useAgentThreadsStore.getState().applySnapshot('t1', [userItem], 'idle')
    useAgentThreadsStore.getState().applySnapshot('t2', [assistantItem], 'working')
    useAgentThreadsStore.getState().reset()
    expect(useAgentThreadsStore.getState().threads).toEqual({})
  })
})
