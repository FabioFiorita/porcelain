import { describe, expect, it } from 'vitest'

import { nextTerminalNumber } from './terminal-naming'

describe('nextTerminalNumber', () => {
  it('starts at 1 for an empty roster', () => {
    expect(nextTerminalNumber([], 0)).toBe(1)
  })

  it('goes past the highest number, not the row count', () => {
    // The bug this exists for: close Terminal 1, and counting rows hands out "Terminal 2" twice.
    expect(nextTerminalNumber(['Terminal 2'], 0)).toBe(3)
  })

  it('ignores renamed sessions when parsing, but still counts them', () => {
    expect(nextTerminalNumber(['web server', 'Terminal 1'], 0)).toBe(3)
  })

  it('never reissues a number below the floor, even if the roster shrank', () => {
    // A stale poll can transiently clobber the optimistic roster; the floor is what stops that
    // window from handing out a name that is already taken.
    expect(nextTerminalNumber([], 7)).toBe(8)
    expect(nextTerminalNumber(['Terminal 1'], 7)).toBe(8)
  })
})
