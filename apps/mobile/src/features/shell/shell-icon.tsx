import type { AndroidSymbol, SFSymbol } from 'expo-symbols'
import { SymbolView } from 'expo-symbols'
import { useColorScheme } from 'react-native'
import type { SurfaceId } from './mock-data'

type IconTone = 'foreground' | 'muted' | 'primary'

const TONE_HEX: Record<'light' | 'dark', Record<IconTone, string>> = {
  light: {
    foreground: '#171A1C',
    muted: '#687076',
    primary: '#0A84FF',
  },
  dark: {
    foreground: '#F5F7FA',
    muted: '#A7B0BB',
    primary: '#0A84FF',
  },
}

/**
 * SF Symbols (iOS) + Material Symbols (Android) for shell chrome.
 * Avoids lucide/RNSVG on the current dev client — Fabric still paints red "U"
 * placeholders for Path hosts despite RNSVG being linked.
 */
const SURFACE_SYMBOLS: Record<SurfaceId, { ios: SFSymbol; android: AndroidSymbol }> = {
  files: { ios: 'folder.fill', android: 'folder' },
  changes: { ios: 'arrow.triangle.branch', android: 'account_tree' },
  review: { ios: 'checkmark.bubble.fill', android: 'rate_review' },
  history: { ios: 'clock.arrow.circlepath', android: 'history' },
  search: { ios: 'magnifyingglass', android: 'search' },
  board: { ios: 'rectangle.split.3x1.fill', android: 'view_kanban' },
  terminal: { ios: 'terminal.fill', android: 'terminal' },
}

const CHROME_SYMBOLS = {
  chevron: { ios: 'chevron.down' as SFSymbol, android: 'expand_more' as AndroidSymbol },
  /** Matches web companion toggle (Zap) — header only. */
  companion: {
    ios: 'bolt.fill' as SFSymbol,
    android: 'bolt' as AndroidSymbol,
  },
  /** Dismiss companion inspector. */
  close: {
    ios: 'xmark' as SFSymbol,
    android: 'close' as AndroidSymbol,
  },
  settings: { ios: 'gearshape' as SFSymbol, android: 'settings' as AndroidSymbol },
  search: { ios: 'magnifyingglass' as SFSymbol, android: 'search' as AndroidSymbol },
  folder: { ios: 'folder' as SFSymbol, android: 'folder_open' as AndroidSymbol },
  branch: { ios: 'arrow.triangle.branch' as SFSymbol, android: 'account_tree' as AndroidSymbol },
  network: { ios: 'network' as SFSymbol, android: 'lan' as AndroidSymbol },
} as const

export type ChromeIconName = keyof typeof CHROME_SYMBOLS

function useToneColor(tone: IconTone): string {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  return TONE_HEX[scheme][tone]
}

function ShellSymbol({
  ios,
  android,
  size,
  tone,
}: {
  ios: SFSymbol
  android: AndroidSymbol
  size: number
  tone: IconTone
}): React.JSX.Element {
  const tintColor = useToneColor(tone)
  return (
    <SymbolView
      name={{ ios, android }}
      size={size}
      tintColor={tintColor}
      weight="medium"
      // Keep AX clean — labels live on the parent button.
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  )
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
    <ShellSymbol
      android={symbol.android}
      ios={symbol.ios}
      size={size}
      tone={active ? 'primary' : 'muted'}
    />
  )
}

export function ChromeGlyph({
  name,
  size = 16,
  tone = 'muted',
}: {
  name: ChromeIconName
  size?: number
  tone?: IconTone
}): React.JSX.Element {
  const symbol = CHROME_SYMBOLS[name]
  return <ShellSymbol android={symbol.android} ios={symbol.ios} size={size} tone={tone} />
}
