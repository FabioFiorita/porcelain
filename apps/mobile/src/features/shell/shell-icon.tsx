import type { AndroidSymbol, SFSymbol } from 'expo-symbols'

import { GlyphSymbol } from '@/components/chrome-glyph'

import type { SurfaceId } from './surfaces'

/** Destination iconography for the rail and the phone tab bar. Chrome icons: `ChromeGlyph`. */
const SURFACE_SYMBOLS: Record<SurfaceId, { ios: SFSymbol; android: AndroidSymbol }> = {
  files: { ios: 'folder.fill', android: 'folder' },
  changes: { ios: 'arrow.triangle.branch', android: 'account_tree' },
  history: { ios: 'clock.arrow.circlepath', android: 'history' },
  search: { ios: 'magnifyingglass', android: 'search' },
  terminal: { ios: 'terminal.fill', android: 'terminal' },
}

export function SurfaceGlyph({
  surface,
  active,
  size = 18,
}: {
  surface: SurfaceId
  active?: boolean
  size?: number
}): React.JSX.Element {
  const symbol = SURFACE_SYMBOLS[surface]
  return (
    <GlyphSymbol
      android={symbol.android}
      ios={symbol.ios}
      size={size}
      tone={active ? 'primary' : 'muted'}
    />
  )
}
