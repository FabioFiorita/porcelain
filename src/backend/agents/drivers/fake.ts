import type { AgentProvider, ModelInfo } from '../../../shared/agent-protocol'
import type { AgentCommand, AgentDriver, StartTurnOptions, TurnHandle } from '../types'

/**
 * A scripted, in-process fake driver — the whole agent turn without a real CLI. It exists
 * because the Playwright e2e suite can't run the actual `claude`/`codex`/`opencode`
 * binaries (they need auth, network, and a signed-in account), yet the Agent UI needs a
 * deterministic turn to drive: a plan, streamed assistant text, a tool that completes, an
 * approval gate (in `approve` mode), and a final usage report. Enabled by
 * `PORCELAIN_AGENT_FAKE=1`, which makes `drivers/index.ts` swap every provider slot for one
 * of these (see `createFakeDriver`). Never used in production.
 *
 * Timing: each step fires ~30ms after the last (fast enough for a test, slow enough that
 * the streaming/plan UI actually renders each stage). `abort` cancels the pending timers;
 * `onDone` fires exactly once whatever ends the turn.
 */

const STEP_MS = 30

const REQUEST_ID = 'fake-approval-1'
const APPROVAL_TITLE = 'Run `rm -rf build`'
const APPROVAL_COMMAND = 'rm -rf build'
const ASSISTANT_TEXT = 'Hello from the fake agent…'

function fakeModels(provider: AgentProvider): ModelInfo[] {
  return [
    {
      id: 'fake-1',
      label: 'Fake Model 1',
      provider,
      efforts: { values: ['low', 'high'], default: 'high' },
    },
  ]
}

function startFakeTurn(opts: StartTurnOptions): TurnHandle {
  let finished = false
  let approvalPending = false
  const timers = new Set<ReturnType<typeof setTimeout>>()

  const schedule = (fn: () => void, delay: number): void => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      fn()
    }, delay)
    timers.add(timer)
  }
  const clearAll = (): void => {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }
  const finish = (ok: boolean): void => {
    if (finished) return
    finished = true
    clearAll()
    opts.onDone({ ok })
  }

  // The final beat every path converges on: a usage-bearing idle status, then onDone.
  const emitFinal = (): void => {
    opts.emit({ t: 'status', status: 'idle', usage: { inputTokens: 100, outputTokens: 50 } })
    finish(true)
  }

  // 1) a plan checklist with one active step
  schedule(() => {
    opts.emit({
      t: 'item',
      item: {
        kind: 'plan',
        id: 'fake-plan',
        steps: [
          { text: 'Read the code', status: 'done' },
          { text: 'Make the change', status: 'active' },
          { text: 'Verify', status: 'pending' },
        ],
      },
    })
  }, STEP_MS)

  // 2) an assistant message, opened then streamed in two deltas, then finalized
  schedule(() => {
    opts.emit({
      t: 'item',
      item: { kind: 'assistant', id: 'fake-msg', text: 'Hello from ', streaming: true },
    })
  }, STEP_MS * 2)
  schedule(() => {
    opts.emit({ t: 'item-delta', id: 'fake-msg', delta: 'the fake agent…' })
  }, STEP_MS * 3)
  schedule(() => {
    opts.emit({
      t: 'item',
      item: { kind: 'assistant', id: 'fake-msg', text: ASSISTANT_TEXT, streaming: false },
    })
  }, STEP_MS * 4)

  // 3) a tool call: running → ok
  schedule(() => {
    opts.emit({
      t: 'item',
      item: { kind: 'tool', id: 'fake-tool', title: 'Run tests', status: 'running' },
    })
  }, STEP_MS * 5)
  schedule(() => {
    opts.emit({
      t: 'item',
      item: { kind: 'tool', id: 'fake-tool', title: 'Run tests', status: 'ok', output: 'ok' },
    })
  }, STEP_MS * 6)

  // 4) in `approve` mode, gate on a pending approval — the turn waits for respondApproval
  // before finishing; otherwise go straight to the final beat.
  schedule(() => {
    if (opts.mode === 'approve') {
      approvalPending = true
      opts.emit({
        t: 'item',
        item: {
          kind: 'approval',
          id: `approval:${REQUEST_ID}`,
          requestId: REQUEST_ID,
          title: APPROVAL_TITLE,
          command: APPROVAL_COMMAND,
          status: 'pending',
        },
      })
    } else {
      emitFinal()
    }
  }, STEP_MS * 7)

  return {
    abort(): void {
      finish(false)
    },
    respondApproval(requestId: string, decision): void {
      if (!approvalPending || requestId !== REQUEST_ID) return
      approvalPending = false
      opts.emit({
        t: 'item',
        item: {
          kind: 'approval',
          id: `approval:${REQUEST_ID}`,
          requestId: REQUEST_ID,
          title: APPROVAL_TITLE,
          command: APPROVAL_COMMAND,
          status: decision === 'decline' ? 'declined' : 'accepted',
        },
      })
      schedule(emitFinal, STEP_MS)
    },
  }
}

/** Build a fake driver for one provider slot (each slot reports its own provider). */
export function createFakeDriver(provider: AgentProvider): AgentDriver {
  return {
    provider,
    status() {
      return Promise.resolve({
        provider,
        installed: true,
        authenticated: true,
        account: 'e2e',
        models: fakeModels(provider),
      })
    },
    startTurn: startFakeTurn,
    generateTitle() {
      return Promise.resolve('Fake thread title')
    },
    listCommands(): Promise<AgentCommand[]> {
      return Promise.resolve([])
    },
  }
}
