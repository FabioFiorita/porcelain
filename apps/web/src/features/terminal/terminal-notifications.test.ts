import { setBackgroundObserver } from '@shared/background'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTerminalRecovery, terminalPasteFailureMessage } from './terminal-notifications'

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
