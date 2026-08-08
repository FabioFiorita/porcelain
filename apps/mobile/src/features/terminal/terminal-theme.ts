/**
 * The terminal palette, per resolved appearance.
 *
 * Deliberately byte-identical to the desktop client's `TERMINAL_THEMES`: the same PTY can be
 * open on a phone and a desktop at once, and a shell's own colour choices (a prompt, a diff,
 * an agent's syntax highlighting) must not mean two different things on the two screens.
 * Dark keeps xterm's stock ANSI set; light overrides it with darker inks that stay legible on
 * a near-white ground.
 */

export type TerminalPalette = {
  background: string
  foreground: string
  cursor: string
  /** ANSI 0–15, in xterm order: black…white, then the bright half. */
  ansi: readonly string[]
}

/** xterm's stock ANSI 16 — what the desktop dark theme inherits by not overriding it. */
const XTERM_ANSI = [
  '#2e3436',
  '#cc0000',
  '#4e9a06',
  '#c4a000',
  '#3465a4',
  '#75507b',
  '#06989a',
  '#d3d7cf',
  '#555753',
  '#ef2929',
  '#8ae234',
  '#fce94f',
  '#729fcf',
  '#ad7fa8',
  '#34e2e2',
  '#eeeeec',
] as const

export const TERMINAL_PALETTES: Record<'light' | 'dark', TerminalPalette> = {
  dark: {
    ansi: XTERM_ANSI,
    background: '#16161a',
    cursor: '#e4e4e7',
    foreground: '#e4e4e7',
  },
  light: {
    ansi: [
      '#24292e',
      '#cf222e',
      '#116329',
      '#7d4e00',
      '#0969da',
      '#8250df',
      '#1b7c83',
      '#6e7781',
      '#57606a',
      '#a40e26',
      '#1a7f37',
      '#633c01',
      '#218bff',
      '#a475f9',
      '#3192aa',
      '#8c959f',
    ],
    background: '#ffffff',
    cursor: '#1f2328',
    foreground: '#1f2328',
  },
}

/** The 6×6×6 colour cube's per-channel steps (indices 16–231). */
const CUBE_STEPS = [0, 95, 135, 175, 215, 255] as const

function hex2(value: number): string {
  return value.toString(16).padStart(2, '0')
}

/**
 * Resolve a 256-colour palette index. 0–15 come from the theme; 16–231 are the standard
 * colour cube and 232–255 the 24-step grey ramp, both computed rather than tabulated because
 * they are defined by formula and every terminal agrees on them.
 */
export function paletteColor(index: number, palette: TerminalPalette): string {
  if (index < 0) return palette.foreground
  if (index < 16) return palette.ansi[index] ?? palette.foreground
  if (index < 232) {
    const offset = index - 16
    const r = CUBE_STEPS[Math.floor(offset / 36) % 6] ?? 0
    const g = CUBE_STEPS[Math.floor(offset / 6) % 6] ?? 0
    const b = CUBE_STEPS[offset % 6] ?? 0
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`
  }
  if (index < 256) {
    const level = 8 + (index - 232) * 10
    return `#${hex2(level)}${hex2(level)}${hex2(level)}`
  }
  return palette.foreground
}

/** A packed 24-bit RGB value (xterm's truecolor form) as a CSS hex string. */
export function rgbColor(packed: number): string {
  return `#${hex2((packed >> 16) & 0xff)}${hex2((packed >> 8) & 0xff)}${hex2(packed & 0xff)}`
}

/**
 * A palette as Ghostty's own config grammar — the string the native canvas is configured with.
 *
 * Ghostty accepts its normal config file syntax here; Android reads this same small portable
 * subset. It lives with the palette rather than with the view so the two renderers cannot drift
 * apart about what "dark" means.
 */
export function nativeThemeConfig(palette: TerminalPalette): string {
  return [
    `background = ${palette.background}`,
    `foreground = ${palette.foreground}`,
    `cursor-color = ${palette.cursor}`,
    ...palette.ansi.map((color, index) => `palette = ${index}=${color}`),
  ].join('\n')
}
