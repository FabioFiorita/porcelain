import { setBackgroundObserver } from '@shared/background'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyTerminalRecovery,
  TerminalRequestError,
  terminalPasteFailureMessage,
} from './terminal-notifications'

describe('Terminal recovery notifications', () => {
  beforeEach(() => {
    setBackgroundObserver(() => undefined)
  })

  afterEach(() => {
    setBackgroundObserver(null)
  })

  it('refetches only the owning roster when recovery asks for fresh truth', () => {
    const refetchRoster = vi.fn(() => Promise.resolve())

    applyTerminalRecovery(
      { reason: 'sequence-gap', reattach: ['term-1'], refreshRoster: true },
      { refetchRoster },
    )

    expect(refetchRoster).toHaveBeenCalledOnce()
  })

  it('maps typed adapter and contract failures to the existing paste copy', () => {
    expect(terminalPasteFailureMessage({ reason: 'not-requestable' })).toBe(
      'This terminal is no longer available.',
    )
    expect(terminalPasteFailureMessage({ reason: 'deadline' })).toBe(
      'The daemon could not save the file. Try again.',
    )
    expect(
      terminalPasteFailureMessage({
        reason: 'server',
        error: {
          code: 'terminal.capacity',
          category: 'capacity',
          message: 'too large',
          retryable: false,
          requestId: 'request-1',
        },
      }),
    ).toBe('That file is too large to attach (8 MiB limit).')
  })
})

describe('Terminal request errors', () => {
  it('carries a human sentence and keeps the typed failure fields', () => {
    const closed = new TerminalRequestError({ reason: 'closed' })
    expect(closed).toBeInstanceOf(Error)
    expect(String(closed)).not.toContain('[object Object]')
    expect(closed.message).toBe(
      'The connection to this Environment is not open. Reconnect and try again.',
    )
    expect(closed.reason).toBe('closed')

    const server = new TerminalRequestError({
      reason: 'server',
      error: {
        code: 'terminal.capacity',
        category: 'unavailable',
        message: 'Too many terminals are open on this Environment.',
        retryable: true,
        requestId: '00000000-0000-4000-8000-000000000000',
      },
    })
    expect(server.message).toBe('Too many terminals are open on this Environment.')
    // The paste classifier reads the same value, so its copy must survive the wrapper.
    expect(terminalPasteFailureMessage(server)).toBe(
      'That file is too large to attach (8 MiB limit).',
    )
  })
})
