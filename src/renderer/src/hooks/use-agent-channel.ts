import {
  abortAgentTurn,
  attachAgent,
  detachAgent,
  onAgentEvent,
  onAgentSnapshot,
  respondAgentApproval,
  sendAgentMessage,
} from '@renderer/lib/daemon'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import type { AgentImage, ApprovalDecision } from '@shared/agent-protocol'
import { useEffect, useMemo } from 'react'

/**
 * Consumes the Agent-thread half of the daemon WS session (lib/daemon.ts), mounted once
 * in AppShell — the Agent twin of `useTerminalChannel`. Live `agent:event`s fold into the
 * per-thread store; each attach snapshot (initial + reconnect re-attach) re-seeds it. This
 * is the ONLY place the store is written from the wire, so a live event can't be clobbered
 * by a late snapshot re-apply (see `onAgentSnapshot`).
 */
export function useAgentChannel(): void {
  const applyEvent = useAgentThreadsStore((s) => s.applyEvent)
  const applySnapshot = useAgentThreadsStore((s) => s.applySnapshot)

  useEffect(() => {
    const offEvent = onAgentEvent((threadId, event) => applyEvent(threadId, event))
    const offSnapshot = onAgentSnapshot((threadId, items, status) =>
      applySnapshot(threadId, items, status),
    )
    return () => {
      offEvent()
      offSnapshot()
    }
  }, [applyEvent, applySnapshot])
}

// A window has ONE socket, so a thread is attached once per window even when its tab is
// cloned into both panes (agent tabs are cloneable — state lives in the store, not a DOM
// node like a terminal). Ref-count the mounted views so the FIRST attaches and only the
// LAST detaches: an unmount of one split pane must not cut the other's live stream.
const viewCounts = new Map<string, number>()

/**
 * The imperative surface components use to drive a thread — the hook boundary that keeps
 * lib/daemon out of components (lint-enforced). `openThread`/`closeThreadView` manage the
 * attach lifecycle (ref-counted for split view); the snapshot seeds the store via the
 * channel's `onAgentSnapshot` listener, so nothing is applied here directly.
 */
export function useAgentActions(): {
  openThread: (threadId: string) => void
  closeThreadView: (threadId: string) => void
  send: (threadId: string, message: { text: string; images?: AgentImage[] }) => void
  abort: (threadId: string) => void
  approve: (threadId: string, requestId: string, decision: ApprovalDecision) => void
} {
  const markDetached = useAgentThreadsStore((s) => s.markDetached)

  return useMemo(
    () => ({
      openThread: (threadId) => {
        const next = (viewCounts.get(threadId) ?? 0) + 1
        viewCounts.set(threadId, next)
        // The reconnect re-attach loop and the store seeding are automatic once attached;
        // a dropped socket rejects here and the next open re-attaches (best-effort).
        if (next === 1) attachAgent(threadId).catch(() => {})
      },
      closeThreadView: (threadId) => {
        const next = (viewCounts.get(threadId) ?? 1) - 1
        if (next > 0) {
          viewCounts.set(threadId, next)
          return
        }
        viewCounts.delete(threadId)
        detachAgent(threadId)
        markDetached(threadId)
      },
      send: (threadId, message) => sendAgentMessage(threadId, message),
      abort: (threadId) => abortAgentTurn(threadId),
      approve: (threadId, requestId, decision) =>
        respondAgentApproval(threadId, requestId, decision),
    }),
    [markDetached],
  )
}
