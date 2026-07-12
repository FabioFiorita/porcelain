import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '../../../shared/agent-protocol'
import { claudeDriver } from './claude'

/**
 * LIVE integration smoke — spawns the REAL `claude` CLI, so it's skipped by default (it
 * needs a logged-in CLI + network + spend). Run manually with `.skip` removed to verify
 * the full spawn → init → stream → result path end-to-end.
 */
describe.skip('claude driver (live)', () => {
  it('runs one minimal turn: session captured, text streams, result closes', async () => {
    const status = await claudeDriver.status()
    expect(status.installed).toBe(true)

    const repoPath = mkdtempSync(join(tmpdir(), 'porcelain-claude-smoke-'))
    const events: AgentEvent[] = []
    let session: unknown = null

    const result = await new Promise<{ ok: boolean }>((resolve) => {
      claudeDriver.startTurn({
        repoPath,
        model: 'haiku',
        mode: 'full',
        interaction: 'build',
        options: {},
        resume: undefined,
        text: 'reply with exactly the word ok, lowercase, nothing else',
        images: [],
        emit: (event) => events.push(event),
        onSessionState: (state) => {
          session = state
        },
        onDone: resolve,
      })
    })

    console.log('SMOKE session', JSON.stringify(session))
    console.log('SMOKE events', JSON.stringify(events))
    console.log('SMOKE done', JSON.stringify(result))

    expect(result.ok).toBe(true)
    expect(session).toMatchObject({ sessionId: expect.any(String) })
    expect(events.some((e) => e.t === 'item' && e.item.kind === 'assistant')).toBe(true)
    expect(events.some((e) => e.t === 'status' && e.status === 'idle')).toBe(true)
  }, 60_000)
})
