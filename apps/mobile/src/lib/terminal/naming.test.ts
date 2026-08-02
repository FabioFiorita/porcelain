import { describe, expect, it } from 'vitest'

import { nextTerminalNumber } from '../../features/terminal/terminal-naming'

describe('nextTerminalNumber', () => {
  it('keeps names monotonic after a session closes', () => {
    expect(nextTerminalNumber(['Terminal 1', 'Terminal 3'], 3)).toBe(4)
    expect(nextTerminalNumber(['Terminal 1'], 4)).toBe(5)
  })

  it('counts non-standard names toward the next slot', () => {
    expect(nextTerminalNumber(['Codex', 'Terminal 1'], 0)).toBe(3)
  })
})
