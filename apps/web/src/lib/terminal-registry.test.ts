import { describe, expect, it } from 'vitest'
import { TERMINAL_THEMES } from './terminal-registry'

describe('TERMINAL_THEMES', () => {
  it('keeps the dark palette byte-identical to the previous inline literal', () => {
    expect(TERMINAL_THEMES.dark).toEqual({
      background: '#16161a',
      foreground: '#e4e4e7',
      cursor: '#e4e4e7',
      selectionBackground: '#3f3f46',
    })
  })

  it('defines a complete, readable light palette on a near-white ground', () => {
    const light = TERMINAL_THEMES.light
    expect(light.background).toBe('#ffffff')
    const keys = [
      'foreground',
      'cursor',
      'selectionBackground',
      'black',
      'red',
      'green',
      'yellow',
      'blue',
      'magenta',
      'cyan',
      'white',
      'brightBlack',
      'brightRed',
      'brightGreen',
      'brightYellow',
      'brightBlue',
      'brightMagenta',
      'brightCyan',
      'brightWhite',
    ] as const
    for (const key of keys) expect(light[key]).toMatch(/^#[0-9a-f]{6}$/)
  })
})
