import { terminalContractFixtures } from '@porcelain/contracts/terminal'
import { describe, expect, it } from 'vitest'

import { TERMINAL_ROSTER_POLL_MS, terminalSessionsForRepo } from './terminal-roster-policy'

describe('mobile Terminal roster boundary', () => {
  it('keeps only the active project sessions, including descendants', () => {
    expect(
      terminalSessionsForRepo(terminalContractFixtures.terminalSessions.output, '/synthetic/repo'),
    ).toEqual(terminalContractFixtures.terminalSessions.output)
    expect(
      terminalSessionsForRepo(terminalContractFixtures.terminalSessions.output, '/other/repo'),
    ).toEqual([])
    expect(terminalSessionsForRepo(terminalContractFixtures.terminalSessions.output, '')).toEqual(
      [],
    )
  })

  it('keeps the five-second poll as the external-kill recovery backstop', () => {
    expect(TERMINAL_ROSTER_POLL_MS).toBe(5_000)
  })
})
