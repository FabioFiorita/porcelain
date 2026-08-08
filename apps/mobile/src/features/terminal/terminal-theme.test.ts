import { describe, expect, it } from 'vitest'

import { nativeThemeConfig, paletteColor, rgbColor, TERMINAL_PALETTES } from './terminal-theme'

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

describe('nativeThemeConfig', () => {
  it("writes the palette in Ghostty's own config grammar", () => {
    const lines = nativeThemeConfig(palette).split('\n')
    expect(lines[0]).toBe(`background = ${palette.background}`)
    expect(lines[1]).toBe(`foreground = ${palette.foreground}`)
    expect(lines[2]).toBe(`cursor-color = ${palette.cursor}`)
  })

  it('numbers every ANSI slot so the canvas and the parser agree on a colour', () => {
    const lines = nativeThemeConfig(palette).split('\n').slice(3)
    expect(lines).toHaveLength(palette.ansi.length)
    expect(lines[0]).toBe(`palette = 0=${palette.ansi[0]}`)
    expect(lines.at(-1)).toBe(`palette = 15=${palette.ansi[15]}`)
  })

  it('says something different for light than for dark', () => {
    expect(nativeThemeConfig(TERMINAL_PALETTES.light)).not.toBe(nativeThemeConfig(palette))
  })
})
