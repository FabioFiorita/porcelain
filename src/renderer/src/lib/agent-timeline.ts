import { writtenPathsFromItems } from '@renderer/lib/agent-touched-files'
import type { TimelineItem } from '@shared/agent-protocol'

/**
 * Conversation timeline rows after turn-folding (T3-style “Worked for…”).
 * Pure: unit-tested without React. The view still runs `groupTimelineItems` on
 * expanded fold bodies so consecutive tools collapse inside the fold.
 */
export type AgentTimelineRow =
  | { kind: 'item'; key: string; item: TimelineItem }
  | {
      kind: 'turn-fold'
      key: string
      /** Items hidden when collapsed (tools, reasoning, plan, intermediate assistants…). */
      items: TimelineItem[]
      /** Elapsed ms when known (latest turn + turnStartedAt); view formats the label. */
      elapsedMs: number | null
    }
  | {
      kind: 'changed-files'
      key: string
      /** Raw tool paths (often absolute) written in this turn. */
      writePaths: string[]
    }

type Turn = {
  user: Extract<TimelineItem, { kind: 'user' }> | null
  /** Everything after the user until the next user (includes terminal assistant). */
  body: TimelineItem[]
}

function splitTurns(items: readonly TimelineItem[]): Turn[] {
  const turns: Turn[] = []
  let current: Turn = { user: null, body: [] }
  for (const item of items) {
    if (item.kind === 'user') {
      if (current.user !== null || current.body.length > 0) {
        turns.push(current)
      }
      current = { user: item, body: [] }
      continue
    }
    current.body.push(item)
  }
  if (current.user !== null || current.body.length > 0) {
    turns.push(current)
  }
  return turns
}

/**
 * Split a turn body into foldable prefix + terminal assistant (last non-streaming
 * assistant, or last assistant if all streaming). Approvals stay outside the fold
 * so the human can still act — they attach after the fold / before the terminal reply.
 */
/**
 * Kinds that stay *outside* a turn fold so the human still sees them after the
 * turn settles (pending approvals to act on; plan checklist for orientation).
 * Tools/reasoning/intermediate assistants remain foldable under “Worked for…”.
 */
const STAY_VISIBLE = new Set(['approval', 'plan'])

function partitionTurnBody(body: readonly TimelineItem[]): {
  foldable: TimelineItem[]
  stayVisible: TimelineItem[]
  terminalAssistant: Extract<TimelineItem, { kind: 'assistant' }> | null
  trailing: TimelineItem[]
} {
  let lastAssistantIndex = -1
  for (let i = body.length - 1; i >= 0; i--) {
    const item = body[i]
    if (item?.kind === 'assistant') {
      lastAssistantIndex = i
      break
    }
  }
  if (lastAssistantIndex === -1) {
    const stayVisible = body.filter((i) => STAY_VISIBLE.has(i.kind))
    const foldable = body.filter((i) => !STAY_VISIBLE.has(i.kind))
    return { foldable, stayVisible, terminalAssistant: null, trailing: [] }
  }
  const terminal = body[lastAssistantIndex]
  if (terminal === undefined || terminal.kind !== 'assistant') {
    return {
      foldable: [...body],
      stayVisible: [],
      terminalAssistant: null,
      trailing: [],
    }
  }
  const before = body.slice(0, lastAssistantIndex)
  const after = body.slice(lastAssistantIndex + 1)
  const stayVisible = before.filter((i) => STAY_VISIBLE.has(i.kind))
  const foldable = before.filter((i) => !STAY_VISIBLE.has(i.kind))
  return {
    foldable,
    stayVisible,
    terminalAssistant: terminal,
    trailing: after,
  }
}

/**
 * Build display rows for the Agent conversation.
 *
 * - Settled turns (not the live working turn): fold intermediate work under a turn-fold row.
 * - Live working turn: expand everything so streaming tools stay visible.
 * - After each terminal assistant with write tools: a `changed-files` row (preview → Changes).
 */
export function buildAgentTimeline(
  items: readonly TimelineItem[],
  options: {
    working: boolean
    /** Epoch ms when the current/last turn started — duration for the latest fold only. */
    turnStartedAt?: number
    now?: number
  },
): AgentTimelineRow[] {
  const turns = splitTurns(items)
  const rows: AgentTimelineRow[] = []
  const now = options.now ?? Date.now()

  for (let t = 0; t < turns.length; t++) {
    const turn = turns[t]
    if (turn === undefined) continue
    const isLatest = t === turns.length - 1
    const settled = !(options.working && isLatest)
    const { foldable, stayVisible, terminalAssistant, trailing } = partitionTurnBody(
      turn.body,
    )

    if (turn.user) {
      rows.push({ kind: 'item', key: turn.user.id, item: turn.user })
    }

    // Only fold when the turn has a finished assistant reply (T3: work hides under
    // the terminal message). Incomplete/tool-only/plan-only timelines stay expanded
    // so tests and mid-turn states remain fully visible.
    const canFold = settled && terminalAssistant !== null && foldable.length > 0
    if (foldable.length > 0) {
      if (canFold) {
        const elapsedMs =
          isLatest && options.turnStartedAt !== undefined
            ? Math.max(0, now - options.turnStartedAt)
            : null
        rows.push({
          kind: 'turn-fold',
          key: `fold:${turn.user?.id ?? foldable[0]?.id ?? t}`,
          items: foldable,
          elapsedMs,
        })
      } else {
        for (const item of foldable) {
          rows.push({ kind: 'item', key: item.id, item })
        }
      }
    }

    // Plan + approvals stay visible outside the fold (orientation / action).
    for (const item of stayVisible) {
      rows.push({ kind: 'item', key: item.id, item })
    }

    if (terminalAssistant) {
      rows.push({ kind: 'item', key: terminalAssistant.id, item: terminalAssistant })
      // Changed-files preview for this turn's writes (tools in foldable + any write after).
      const turnItems = [...(turn.user ? [turn.user] : []), ...turn.body]
      const writePaths = writtenPathsFromItems(turnItems)
      if (writePaths.length > 0 && !terminalAssistant.streaming) {
        rows.push({
          kind: 'changed-files',
          key: `files:${terminalAssistant.id}`,
          writePaths,
        })
      }
    }

    for (const item of trailing) {
      rows.push({ kind: 'item', key: item.id, item })
    }
  }

  return rows
}
