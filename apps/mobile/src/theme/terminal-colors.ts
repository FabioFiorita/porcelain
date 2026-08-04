/**
 * The terminal surface's own palette. Pure, like the rest of `theme/` — the hook that reads the
 * system appearance stays in `use-accent-color.ts`.
 *
 * `background` and `foreground` must stay identical to the xterm themes baked into
 * `webview/terminal-html.generated.ts` (see `scripts/build-terminal-webview.mjs`). The WebView
 * picks its theme from `prefers-color-scheme`, so any value hardcoded on the React Native side
 * disagrees with the emulator the moment the appearance changes — which is exactly how the chrome
 * came to frame a white terminal in black.
 */

import { type AppearanceScheme, accentColor } from './colors'

type TerminalPalette = {
  /** The emulator's own background. The chrome matches it so the surface reads as one plane. */
  background: string
  foreground: string
  /** Key bar and composer — a step off the background so the controls read as chrome. */
  surface: string
  border: string
  /** Rest state of a key-bar button. */
  keyFill: string
  keyBorder: string
  mutedText: string
  /** Armed modifier / open composer. */
  activeFill: string
  activeText: string
  /** Reconnecting banner. */
  noticeFill: string
  noticeText: string
  errorText: string
}

const TERMINAL: Record<AppearanceScheme, TerminalPalette> = {
  dark: {
    activeFill: accentColor('dark'),
    activeText: '#FFFFFF',
    background: '#16161A',
    border: '#383A40',
    errorText: '#FF6961',
    foreground: '#E4E4E7',
    keyBorder: '#4B4D55',
    keyFill: '#303238',
    mutedText: '#8E8E93',
    noticeFill: '#3A2E10',
    noticeText: '#FFD60A',
    surface: '#1F2024',
  },
  light: {
    activeFill: accentColor('light'),
    activeText: '#FFFFFF',
    background: '#FFFFFF',
    border: '#D1D1D6',
    errorText: '#C7362B',
    foreground: '#1F2328',
    keyBorder: '#C7C7CC',
    keyFill: '#E9E9EB',
    mutedText: '#6E7781',
    noticeFill: '#FFF4CC',
    noticeText: '#7D4E00',
    surface: '#F2F2F7',
  },
}

export function terminalColors(scheme: AppearanceScheme): TerminalPalette {
  return TERMINAL[scheme]
}
