/**
 * The palette both clients paint from. Pure on purpose — no React, no `react-native` — so the
 * mapping can be unit tested; the hook that reads the system appearance lives in
 * `use-accent-color.ts`.
 */

/**
 * The app's accent, tracking the desktop renderer's `--info` token — the blue it already
 * paints worktree dots, review inbox marks and status icons with. Desktop's `--primary`
 * is a darker button blue that reads muddy as an iOS tint over black, so the two clients
 * share the hue and not the shade.
 */
const ACCENT = {
  dark: '#00A6F4',
  light: '#0084D1',
} as const

/**
 * Git status tints, mirroring the renderer's `changes-list.tsx` mapping (success/warning/
 * destructive/info) in iOS system colours so both clients tell the same story about a file.
 */
const STATUS_TINTS = {
  added: '#34C759',
  deleted: '#FF3B30',
  modified: '#FF9500',
  renamed: ACCENT.dark,
  untracked: '#34C759',
} as const

export function statusTint(status: keyof typeof STATUS_TINTS | undefined): string {
  return status === undefined ? STATUS_TINTS.modified : STATUS_TINTS[status]
}

/** Diff line backgrounds. Deep enough to read over the list background, light enough that
 *  monospaced text on top keeps system contrast in both appearances. */
const DIFF_BACKGROUNDS = {
  dark: { add: '#15321F', del: '#3A1A1C' },
  light: { add: '#E4F5E9', del: '#FDE7E7' },
} as const

export type AppearanceScheme = 'light' | 'dark'

/**
 * The renderer's `--ink-*` tokens, converted from oklch to the hex the row canvas parses, plus the
 * secondary grey the surfaces already use. Both clients name a file's type with the same hue: a
 * `.ts` file has no business being blue in the sidebar and green on the phone.
 */
const INK = {
  dark: {
    amber: '#FFB900',
    blue: '#51A2FF',
    cyan: '#00D3F2',
    emerald: '#00D492',
    green: '#05DF72',
    indigo: '#7C86FF',
    muted: '#8E8E93',
    orange: '#FF8904',
    pink: '#FB64B6',
    purple: '#C27AFF',
    red: '#FF6467',
    sky: '#00BCFF',
    teal: '#00D5BE',
    violet: '#A684FF',
    yellow: '#FDC700',
  },
  light: {
    amber: '#E17100',
    blue: '#155DFC',
    cyan: '#0092B8',
    emerald: '#009966',
    green: '#00A63E',
    indigo: '#4F39F6',
    muted: '#6C6C70',
    orange: '#F54900',
    pink: '#E60076',
    purple: '#9810FA',
    red: '#E7000B',
    sky: '#0084D1',
    teal: '#009689',
    violet: '#7F22FE',
    yellow: '#D08700',
  },
} as const

export type InkColor = keyof (typeof INK)['dark']

export function ink(color: InkColor, scheme: AppearanceScheme): string {
  return INK[scheme][color]
}

export function diffBackgrounds(scheme: AppearanceScheme): { add: string; del: string } {
  return DIFF_BACKGROUNDS[scheme]
}

export function accentColor(scheme: AppearanceScheme): string {
  return ACCENT[scheme]
}
