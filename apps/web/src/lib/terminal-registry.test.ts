import { describe, expect, it } from 'vitest'
import { pushCappedOutput, TERMINAL_THEMES } from './terminal-registry'

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

describe('pushCappedOutput', () => {
  it('buffers freely under the cap', () => {
    const buffer: string[] = []
    let units = 0
    for (let i = 0; i < 5; i += 1) units = pushCappedOutput(buffer, units, 'x'.repeat(10), 100)
    expect(buffer).toHaveLength(5)
    expect(units).toBe(50)
  })

  it('drops oldest chunks first once the cap is exceeded', () => {
    const buffer: string[] = []
    let units = 0
    units = pushCappedOutput(buffer, units, 'a'.repeat(60), 100)
    units = pushCappedOutput(buffer, units, 'b'.repeat(60), 100)
    expect(buffer).toEqual(['b'.repeat(60)])
    expect(units).toBe(60)
    units = pushCappedOutput(buffer, units, 'c'.repeat(30), 100)
    expect(buffer).toEqual(['b'.repeat(60), 'c'.repeat(30)])
    expect(units).toBe(90)
  })

  it('always keeps the newest chunk even when it alone exceeds the cap', () => {
    const buffer: string[] = ['seed']
    const units = pushCappedOutput(buffer, 4, 'z'.repeat(2000), 100)
    expect(buffer).toEqual(['z'.repeat(2000)])
    expect(units).toBe(2000)
  })
})
