import type { RowCanvasTheme } from '@/lib/row-canvas/types'
import { type AppearanceScheme, accentColor, ink } from '@/theme/colors'

/**
 * The palette for path lists — the file tree, changed files, history. Same canvas the diff draws
 * on, so a file reads the same in the list and in the diff it opens; only the metrics differ,
 * because a list is tapped and a diff is read.
 */

const SURFACE = {
  dark: {
    background: '#000000',
    border: '#2C2C2E',
    section: '#141416',
    text: '#EDEDED',
  },
  light: {
    background: '#FFFFFF',
    border: '#D1D1D6',
    section: '#F2F2F7',
    text: '#1C1C1E',
  },
} as const

/** Width of one symbol slot, in characters. The canvas rounds it; the adapter pads with it. */
export const SYMBOL_COLUMNS = 3

/** Characters of indent per tree level. */
export const INDENT_COLUMNS = 2

export function listCanvasTheme(scheme: AppearanceScheme): RowCanvasTheme {
  const surface = SURFACE[scheme]
  const accent = accentColor(scheme)
  const muted = ink('muted', scheme)

  return {
    // A path list has no per-row accent bar and no line numbers, so both columns collapse and the
    // first glyph starts near the edge — the indent is what has to carry depth, not padding.
    accentBarWidth: 0,
    background: surface.background,
    border: surface.border,
    contentPadding: 8,
    fontSize: 13,
    fontWeight: 'regular',
    gutterFontSize: 11,
    gutterWidth: 4,
    maxContentWidth: 6000,
    mutedText: muted,
    roles: {
      dim: { fg: muted },
      entry: { fg: surface.text },
      section: { bg: surface.section, fg: muted },
    },
    // Roughly half the stock SwiftUI row: enough of a target on a phone, dense enough that a
    // directory reads as a shape rather than a scroll.
    rowHeight: 32,
    selection: `${accent}38`,
    symbolColumns: SYMBOL_COLUMNS,
    text: surface.text,
  }
}
