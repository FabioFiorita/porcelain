import type { RowCanvasTheme } from '@/lib/row-canvas/types'
import { type AppearanceScheme, accentColor, diffBackgrounds } from '@/theme/colors'

/**
 * The diff surface's palette, expressed as canvas roles. Every colour the native view paints
 * comes from here: the Swift side ships neutral system fallbacks only, so a role this file
 * forgets shows up as plain text rather than as a second hard-coded theme.
 */

const SURFACE = {
  dark: {
    background: '#000000',
    border: '#2C2C2E',
    header: '#141416',
    hunk: '#10222B',
    muted: '#8E8E93',
    text: '#EDEDED',
  },
  light: {
    background: '#FFFFFF',
    border: '#D1D1D6',
    header: '#F2F2F7',
    hunk: '#E5F0FA',
    muted: '#6C6C70',
    text: '#1C1C1E',
  },
} as const

const ADD_BAR = '#34C759'
const DEL_BAR = '#FF3B30'
/** Alpha rides in the last byte: the canvas parses `RRGGBBAA`, never `AARRGGBB`. */
const ADD_HIGHLIGHT = '#34C75959'
const DEL_HIGHLIGHT = '#FF3B3059'

export function diffCanvasTheme(scheme: AppearanceScheme): RowCanvasTheme {
  const surface = SURFACE[scheme]
  const accent = accentColor(scheme)
  const backgrounds = diffBackgrounds(scheme)

  return {
    accentBarWidth: 3,
    background: surface.background,
    border: surface.border,
    contentPadding: 8,
    fontSize: 12,
    fontWeight: 'regular',
    gutterFontSize: 10,
    gutterWidth: 38,
    maxContentWidth: 6000,
    mutedText: surface.muted,
    roles: {
      add: {
        accent: ADD_BAR,
        bg: backgrounds.add,
        fg: surface.text,
        highlight: ADD_HIGHLIGHT,
      },
      context: { fg: surface.text },
      del: {
        accent: DEL_BAR,
        bg: backgrounds.del,
        fg: surface.text,
        highlight: DEL_HIGHLIGHT,
      },
      file: { bg: surface.header, fg: surface.text },
      hunk: { bg: surface.hunk, fg: accent },
      layer: { fg: surface.muted },
      notice: { fg: surface.muted },
    },
    rowHeight: 18,
    selection: `${accent}38`,
    text: surface.text,
  }
}
