import { publicErrorFixtures } from '@porcelain/contracts'
import { describe, expect, it, vi } from 'vitest'

import { applyTerminalRecovery, terminalPasteFailureMessage } from './terminal-recovery'

vi.mock('expo-crypto', () => ({
  randomUUID: (() => {
    let next = 0
    return (): string => `synthetic-request-${++next}`
  })(),
}))

describe('mobile Terminal recovery bridge', () => {
  it('refetches only the owning roster and does not handle stream bytes', () => {
    const refetchRoster = vi.fn(() => Promise.resolve())

    applyTerminalRecovery(
      { reason: 'sequence-gap', reattach: ['term-1'], refreshRoster: true },
      { refetchRoster },
    )

    expect(refetchRoster).toHaveBeenCalledTimes(1)
  })

  it('maps typed adapter and contract failures to the existing paste copy', () => {
    expect(terminalPasteFailureMessage({ reason: 'closed' })).toBe(
      'This terminal is no longer available.',
    )
    expect(terminalPasteFailureMessage({ reason: 'deadline' })).toBe(
      'The daemon could not save the file. Try again.',
    )
    expect(terminalPasteFailureMessage({ reason: 'not-requestable' })).toBe(
      'This terminal is no longer available.',
    )
    expect(
      terminalPasteFailureMessage({
        error: publicErrorFixtures['terminal.capacity'],
        reason: 'server',
      }),
    ).toBe('That file is too large to attach (8 MiB limit).')
    expect(
      terminalPasteFailureMessage({
        error: publicErrorFixtures['terminal.not-found'],
        reason: 'server',
      }),
    ).toBe('This terminal is no longer available.')
    expect(
      terminalPasteFailureMessage({
        error: publicErrorFixtures['terminal.exited'],
        reason: 'server',
      }),
    ).toBe('This terminal is no longer available.')
    expect(
      terminalPasteFailureMessage({
        error: publicErrorFixtures['terminal.invalid-size'],
        reason: 'server',
      }),
    ).toBe('That file is too large to attach (8 MiB limit).')
    expect(
      terminalPasteFailureMessage({
        error: publicErrorFixtures['terminal.paste-unavailable'],
        reason: 'server',
      }),
    ).toBe('The daemon could not save the file. Try again.')
  })
})
