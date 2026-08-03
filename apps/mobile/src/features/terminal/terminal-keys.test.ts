import { describe, expect, it } from 'vitest'

import { controlByte, type EditChord, terminalArrowBytes, terminalEditBytes } from './terminal-keys'

describe('terminal keys', () => {
  it('maps control characters and cursor modes to PTY bytes', () => {
    expect(controlByte('c')).toBe('\x03')
    expect(controlByte('?')).toBe('\x7f')
    expect(controlByte('!')).toBeNull()
    expect(terminalArrowBytes('up', false)).toBe('\x1b[A')
    expect(terminalArrowBytes('up', true)).toBe('\x1bOA')
  })

  it('keeps the desktop edit chord table pure and portable', () => {
    const chord: EditChord = {
      altKey: false,
      ctrlKey: false,
      key: 'Enter',
      metaKey: true,
      shiftKey: false,
    }

    expect(terminalEditBytes(chord)).toBe('\x1b\r')
    expect(
      terminalEditBytes({
        altKey: true,
        ctrlKey: false,
        key: 'ArrowRight',
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe('\x1bf')
    expect(
      terminalEditBytes({
        altKey: false,
        ctrlKey: false,
        key: 'Enter',
        metaKey: false,
        shiftKey: false,
      }),
    ).toBeNull()
  })
})
