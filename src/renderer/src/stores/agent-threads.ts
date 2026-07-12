import {
  type AgentEvent,
  type AgentStatus,
  applyAgentEvent,
  type TimelineItem,
} from '@shared/agent-protocol'
import { create } from 'zustand'

/**
 * The Agent tab's per-thread LIVE state: the reduced timeline + run status a viewer tab
 * renders, seeded by an attach snapshot and folded forward by `applyAgentEvent` (the same
 * pure reducer the daemon persists with, so an attaching client converges on what the
 * daemon stored). The roster (titles, provider, model) stays in TanStack Query — this
 * store is only the streaming state, the Agent-thread twin of the terminal registry.
 *
 * `attached` tracks whether this window is currently streaming the thread; a detached
 * entry keeps its last items so re-opening shows them instantly while the fresh snapshot
 * arrives. Keyed by thread id.
 */
export interface AgentThreadState {
  items: TimelineItem[]
  status: AgentStatus
  attached: boolean
}

interface AgentThreadsState {
  threads: Record<string, AgentThreadState>
  /** Seed (or replace) a thread's timeline + status from an attach snapshot. */
  applySnapshot: (threadId: string, items: TimelineItem[], status: AgentStatus) => void
  /** Fold one live event into a thread: `applyAgentEvent` for the timeline, `status` for run state. */
  applyEvent: (threadId: string, event: AgentEvent) => void
  /** Mark a thread's view detached (its stream stopped) — keeps the last items for a re-open. */
  markDetached: (threadId: string) => void
  /** Drop a thread's live state entirely (the thread was deleted). */
  remove: (threadId: string) => void
  /** Clear every thread (repo switch / teardown). */
  reset: () => void
}

const emptyThread = (): AgentThreadState => ({ items: [], status: 'idle', attached: true })

export const useAgentThreadsStore = create<AgentThreadsState>((set) => ({
  threads: {},
  applySnapshot: (threadId, items, status) =>
    set((state) => ({
      threads: { ...state.threads, [threadId]: { items, status, attached: true } },
    })),
  applyEvent: (threadId, event) =>
    set((state) => {
      const current = state.threads[threadId] ?? emptyThread()
      const items = applyAgentEvent(current.items, event)
      const status = event.t === 'status' ? event.status : current.status
      return { threads: { ...state.threads, [threadId]: { ...current, items, status } } }
    }),
  markDetached: (threadId) =>
    set((state) => {
      const current = state.threads[threadId]
      if (!current) return state
      return { threads: { ...state.threads, [threadId]: { ...current, attached: false } } }
    }),
  remove: (threadId) =>
    set((state) => {
      if (!(threadId in state.threads)) return state
      const { [threadId]: _removed, ...rest } = state.threads
      return { threads: rest }
    }),
  reset: () => set({ threads: {} }),
}))
