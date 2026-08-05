import { describe, expect, it } from 'vitest'

import { paletteColor, rgbColor, TERMINAL_PALETTES } from './terminal-theme'

const palette = TERMINAL_PALETTES.dark

describe('paletteColor', () => {
  it('takes 0–15 from the theme so light and dark can differ', () => {
    expect(paletteColor(0, palette)).toBe(palette.ansi[0])
    expect(paletteColor(15, palette)).toBe(palette.ansi[15])
    expect(paletteColor(1, TERMINAL_PALETTES.light)).not.toBe(paletteColor(1, palette))
  })

  it('computes the 6x6x6 cube the way every terminal does', () => {
    expect(paletteColor(16, palette)).toBe('#000000')
    expect(paletteColor(196, palette)).toBe('#ff0000')
    expect(paletteColor(46, palette)).toBe('#00ff00')
    expect(paletteColor(21, palette)).toBe('#0000ff')
    expect(paletteColor(231, palette)).toBe('#ffffff')
  })

  it('computes the 24-step grey ramp', () => {
    expect(paletteColor(232, palette)).toBe('#080808')
    expect(paletteColor(255, palette)).toBe('#eeeeee')
  })

  it('falls back to the foreground for an index no palette defines', () => {
    expect(paletteColor(-1, palette)).toBe(palette.foreground)
    expect(paletteColor(256, palette)).toBe(palette.foreground)
  })
})

describe('rgbColor', () => {
  it('unpacks 24-bit truecolor, padding each channel', () => {
    expect(rgbColor(0xff0000)).toBe('#ff0000')
    expect(rgbColor(0x010203)).toBe('#010203')
    expect(rgbColor(0)).toBe('#000000')
  })
})
