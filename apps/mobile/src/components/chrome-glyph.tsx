import type { AndroidSymbol, SFSymbol } from 'expo-symbols'
import { SymbolView } from 'expo-symbols'
import { useColorScheme } from 'react-native'

import { themeVarsFor } from '@/features/settings/theme-vars'

export type IconTone =
  | 'foreground'
  | 'muted'
  | 'primary'
  | 'primaryForeground'
  | 'success'
  | 'destructive'

// SymbolView tints with a color value, not a class, so the semantic palette is resolved
// from the same token maps the CSS variables come from (`@porcelain/ui` tokens.css).
const TONE_VAR: Record<IconTone, string> = {
  destructive: 'destructive',
  foreground: 'foreground',
  muted: 'muted-foreground',
  primary: 'primary',
  primaryForeground: 'primary-foreground',
  success: 'success',
}

function toneHex(scheme: 'light' | 'dark', tone: IconTone): string {
  return themeVarsFor(scheme)[TONE_VAR[tone]] ?? '#000000'
}

/**
 * SF Symbols (iOS) + Material Symbols (Android) for app chrome.
 *
 * Deliberately not lucide/react-native-svg: Fabric still paints red "U" placeholders for
 * Path hosts on the current dev client, so every icon in shipped UI comes from here.
 */
const CHROME_SYMBOLS = {
  chevron: { ios: 'chevron.down' as SFSymbol, android: 'expand_more' as AndroidSymbol },
  /** `chevron`'s mirror — the up-facing member of the same pair, not `arrowUp`'s style. */
  chevronUp: { ios: 'chevron.up' as SFSymbol, android: 'expand_less' as AndroidSymbol },
  /** Matches the web companion toggle (Zap) — header only. */
  companion: { ios: 'bolt.fill' as SFSymbol, android: 'bolt' as AndroidSymbol },
  /** Dismiss companion inspector. */
  close: { ios: 'xmark' as SFSymbol, android: 'close' as AndroidSymbol },
  settings: { ios: 'gearshape' as SFSymbol, android: 'settings' as AndroidSymbol },
  search: { ios: 'magnifyingglass' as SFSymbol, android: 'search' as AndroidSymbol },
  arrowUp: { ios: 'arrow.up' as SFSymbol, android: 'arrow_upward' as AndroidSymbol },
  /**
   * Reorder a row within a list. NOT `arrowDown`, which is `arrow.down.to.line` / `download`
   * — a transfer, not a move, and the pair has to read as each other's mirror.
   */
  moveDown: { ios: 'arrow.down' as SFSymbol, android: 'arrow_downward' as AndroidSymbol },
  /** The endpoint a group is tried on first. */
  star: { ios: 'star.fill' as SFSymbol, android: 'star' as AndroidSymbol },
  folder: { ios: 'folder' as SFSymbol, android: 'folder_open' as AndroidSymbol },
  branch: { ios: 'arrow.triangle.branch' as SFSymbol, android: 'account_tree' as AndroidSymbol },
  network: { ios: 'network' as SFSymbol, android: 'lan' as AndroidSymbol },
  desktop: { ios: 'desktopcomputer' as SFSymbol, android: 'desktop_windows' as AndroidSymbol },
  terminal: { ios: 'terminal' as SFSymbol, android: 'terminal' as AndroidSymbol },
  notebook: { ios: 'laptopcomputer' as SFSymbol, android: 'laptop' as AndroidSymbol },
  chevronRight: { ios: 'chevron.right' as SFSymbol, android: 'chevron_right' as AndroidSymbol },
  chevronLeft: { ios: 'chevron.left' as SFSymbol, android: 'chevron_left' as AndroidSymbol },
  trash: { ios: 'trash' as SFSymbol, android: 'delete' as AndroidSymbol },
  plus: { ios: 'plus' as SFSymbol, android: 'add' as AndroidSymbol },
  minus: { ios: 'minus' as SFSymbol, android: 'remove' as AndroidSymbol },
  check: { ios: 'checkmark' as SFSymbol, android: 'check' as AndroidSymbol },
  /* Changes header: bulk mark-reviewed, its inverse, and the continuous "read all" surface. */
  checklist: { ios: 'checklist' as SFSymbol, android: 'checklist' as AndroidSymbol },
  checklistOff: { ios: 'checklist.unchecked' as SFSymbol, android: 'remove_done' as AndroidSymbol },
  readAll: { ios: 'list.bullet.rectangle' as SFSymbol, android: 'view_agenda' as AndroidSymbol },
  /* Reviewed state on a file row / diff header. */
  square: { ios: 'square' as SFSymbol, android: 'check_box_outline_blank' as AndroidSymbol },
  squareCheck: { ios: 'checkmark.square.fill' as SFSymbol, android: 'check_box' as AndroidSymbol },
  file: { ios: 'doc.text' as SFSymbol, android: 'description' as AndroidSymbol },
  /* Files tab: the tree rows and their scope actions. */
  folderFill: { ios: 'folder.fill' as SFSymbol, android: 'folder' as AndroidSymbol },
  pin: { ios: 'pin' as SFSymbol, android: 'push_pin' as AndroidSymbol },
  pinOff: { ios: 'pin.slash' as SFSymbol, android: 'keep_off' as AndroidSymbol },
  eye: { ios: 'eye' as SFSymbol, android: 'visibility' as AndroidSymbol },
  eyeOff: { ios: 'eye.slash' as SFSymbol, android: 'visibility_off' as AndroidSymbol },
  image: { ios: 'photo' as SFSymbol, android: 'image' as AndroidSymbol },
  play: { ios: 'play.fill' as SFSymbol, android: 'play_arrow' as AndroidSymbol },
  code: { ios: 'curlybraces' as SFSymbol, android: 'code' as AndroidSymbol },
  comment: { ios: 'bubble.left' as SFSymbol, android: 'chat_bubble' as AndroidSymbol },
  /** History's commit menu: copy the SHA, copy the message. */
  copy: { ios: 'doc.on.doc' as SFSymbol, android: 'content_copy' as AndroidSymbol },
  commentAdd: {
    ios: 'bubble.left.and.text.bubble.right' as SFSymbol,
    android: 'add_comment' as AndroidSymbol,
  },
  /* Companion: generation, quick commands, and commit. */
  sparkles: { ios: 'sparkles' as SFSymbol, android: 'auto_awesome' as AndroidSymbol },
  layers: { ios: 'square.stack.3d.up' as SFSymbol, android: 'layers' as AndroidSymbol },
  commit: { ios: 'arrow.triangle.pull' as SFSymbol, android: 'commit' as AndroidSymbol },
  info: { ios: 'info.circle' as SFSymbol, android: 'info' as AndroidSymbol },
  arrowDown: { ios: 'arrow.down.to.line' as SFSymbol, android: 'download' as AndroidSymbol },
  arrowUpFromLine: { ios: 'arrow.up.to.line' as SFSymbol, android: 'upload' as AndroidSymbol },
  refresh: { ios: 'arrow.clockwise' as SFSymbol, android: 'refresh' as AndroidSymbol },
  archive: { ios: 'archivebox' as SFSymbol, android: 'archive' as AndroidSymbol },
  archiveRestore: { ios: 'arrow.up.bin' as SFSymbol, android: 'unarchive' as AndroidSymbol },
  undo: { ios: 'arrow.uturn.backward' as SFSymbol, android: 'undo' as AndroidSymbol },
  eraser: { ios: 'eraser' as SFSymbol, android: 'ink_eraser' as AndroidSymbol },
  circleCheck: {
    ios: 'checkmark.circle.fill' as SFSymbol,
    android: 'check_circle' as AndroidSymbol,
  },
  circleX: { ios: 'xmark.circle.fill' as SFSymbol, android: 'cancel' as AndroidSymbol },
  /** Files tab: rename a tree entry. */
  pencil: { ios: 'pencil' as SFSymbol, android: 'edit' as AndroidSymbol },
  /** Terminal key bar: insert a newline instead of submitting the line (⇧↵). */
  newline: { ios: 'return' as SFSymbol, android: 'keyboard_return' as AndroidSymbol },
} as const

export type ChromeIconName = keyof typeof CHROME_SYMBOLS

function useToneColor(tone: IconTone): string {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  return toneHex(scheme, tone)
}

/** The raw symbol host. Exported so surface iconography can share the tone palette. */
export function GlyphSymbol({
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
  return <GlyphSymbol android={symbol.android} ios={symbol.ios} size={size} tone={tone} />
}
