import type { RowCanvasTheme } from '@/lib/row-canvas/types'
import { type AppearanceScheme, accentColor, ink } from '@/theme/colors'

/**
 * Source file palette on the same canvas the diff uses. No add/del roles — just monospaced
 * text with a line-number gutter — so a file reads the same whether opened from Files or from
 * a change list.
 */

const SURFACE = {
  dark: {
    background: '#000000',
    border: '#2C2C2E',
    text: '#EDEDED',
  },
  light: {
    background: '#FFFFFF',
    border: '#D1D1D6',
    text: '#1C1C1E',
  },
} as const

export function sourceCanvasTheme(scheme: AppearanceScheme): RowCanvasTheme {
  const surface = SURFACE[scheme]
  const accent = accentColor(scheme)
  const muted = ink('muted', scheme)

  return {
    accentBarWidth: 0,
    background: surface.background,
    border: surface.border,
    contentPadding: 8,
    fontSize: 12,
    fontWeight: 'regular',
    gutterFontSize: 10,
    gutterWidth: 42,
    maxContentWidth: 6000,
    mutedText: muted,
    roles: {
      line: { fg: surface.text },
    },
    rowHeight: 18,
    selection: `${accent}38`,
    text: surface.text,
  }
}
