import { describe, expect, it } from 'vitest'
import {
  initialInputQuietDelay,
  QUIET_AFTER_NEWLINE_MS,
  QUIET_AFTER_PROMPT_MS,
} from './initial-input'

describe('initialInputQuietDelay', () => {
  it('arms the short window for a prompt-shaped chunk (cursor parked after "$ ")', () => {
    expect(initialInputQuietDelay('host:repo user$ ')).toBe(QUIET_AFTER_PROMPT_MS)
  })

  it('arms the short window for a fancy prompt ending in escape sequences', () => {
    expect(initialInputQuietDelay('\x1b[1;32m❯\x1b[0m ')).toBe(QUIET_AFTER_PROMPT_MS)
  })

  it('stays cautious after a newline-terminated chunk (banner/profile output)', () => {
    expect(initialInputQuietDelay('The default interactive shell is now zsh.\r\n')).toBe(
      QUIET_AFTER_NEWLINE_MS,
    )
  })

  it('treats a bare \\n tail as newline-terminated too', () => {
    expect(initialInputQuietDelay('line\n')).toBe(QUIET_AFTER_NEWLINE_MS)
  })
})
