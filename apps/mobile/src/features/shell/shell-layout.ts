/**
 * When the tablet shell shows two columns, and when it shows one.
 *
 * The decision is a pure function of the window width and the route, deliberately: an iPad
 * window resizes LIVE — Stage Manager and Split View hand the app a new width mid-session, and
 * `useIsTablet` stays true through all of it because an iPad is an iPad at any width. Something
 * has to answer "does this window still have room for a sidebar", and a function with no React
 * in it is the piece that can be tested without a simulator.
 *
 * Nothing here imports `react-native` or `expo-router` on purpose: the unit suite runs in jsdom
 * (`apps/desktop/vitest.config.ts` sweeps `apps/mobile/src/**`), so the width→layout rule has to
 * be reachable without a native runtime.
 */

/**
 * A side panel's width, in points.
 *
 * A Worktree row prints a name over a branch with an Environment nickname beside it; 320 is the
 * width that fits the pair without truncating both, and it is the same order as the web client's
 * default sidebar. The companion panel takes the same width, because two panels of different
 * widths around one viewer is a window that looks like it was assembled rather than designed.
 */
export const HUB_SIDEBAR_WIDTH = 320

/**
 * The narrowest window that gets two columns.
 *
 * `HUB_SIDEBAR_WIDTH` (320) plus the ~448 a diff or a file body needs before it starts wrapping
 * every line — so 768, which is also the classic regular-width threshold. Below it the sidebar
 * would be paid for out of the content column, and the content column is the reason the split
 * exists. An 11" iPad is 834 wide in portrait (split) and 507 in a half-screen Split View
 * (single), which is the behaviour a human expects when they drag the divider.
 */
export const SPLIT_MIN_WIDTH = 768

/** One column (the phone shape, at tablet size) or the list beside the screen it opened. */
export type ShellLayout = 'single' | 'split'

/**
 * `unchanged` is the third answer, and it is about sheets.
 *
 * A `formSheet` route is presented OVER the screen that opened it, so the pathname changes while
 * what is behind the sheet does not. Recomputing from the sheet's own path would collapse the
 * columns underneath it — the layout has to hold whatever it was when the sheet went up.
 */
export type ShellLayoutDecision = ShellLayout | 'unchanged'

/** Hub routes that are presented rather than pushed — see `SHEET` in `app/(hub)/_layout.tsx`. */
const HUB_SHEET_PATHS = ['/quick-open', '/new-worktree'] as const

/**
 * Router group segments — `(hub)` — never reach `usePathname`, but normalising costs one regex
 * and means a caller passing a raw segment list joined by hand still lands on the same answer.
 */
function normalize(pathname: string): string {
  const withoutGroups = pathname.replace(/\/\([^)]*\)/g, '')
  const trimmed = withoutGroups.replace(/\/+$/, '')
  return trimmed.length === 0 ? '/' : trimmed
}

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * Which shape this window wants.
 *
 * The rule is now the window's alone, and that is the change: the panels used to appear only
 * once the Hub stack was deeper than its own list, so an iPad showed a phone screen at the Hub
 * root, at Terminals and at Settings — three of the four places you can stand. The web
 * client does not do that. Its sidebar is where the app's navigation lives at every route, and
 * an iPad that means to replace the desktop has to be the same window, not a phone that
 * occasionally widens.
 *
 * What is left:
 *
 *   1. **A narrow window is one column**, whatever route it is on. This is the iPad multitasking
 *      case, and it beats everything below — including a sheet, because a sheet cannot make room
 *      the window does not have.
 *   2. **A sheet changes nothing.** See `ShellLayoutDecision`.
 *   3. **Anything else is the three-pane window.**
 */
export function decideShellLayout({
  pathname,
  width,
}: {
  pathname: string
  width: number
}): ShellLayoutDecision {
  if (width < SPLIT_MIN_WIDTH) return 'single'
  if (HUB_SHEET_PATHS.some((sheet) => isUnder(normalize(pathname), sheet))) return 'unchanged'
  return 'split'
}
