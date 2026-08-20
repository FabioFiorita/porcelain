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
 * The sidebar column's width, in points.
 *
 * A Worktree row prints a name over a branch with an Environment nickname beside it; 320 is the
 * width that fits the pair without truncating both, and it is the same order as the web client's
 * default sidebar.
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

/** The three tabs that are not the Hub. Their stacks are single-column by design. */
const OTHER_TAB_PREFIXES = ['/terminals', '/tasks', '/settings'] as const

/** Hub routes that are presented rather than pushed — see `SHEET` in `app/(hub)/_layout.tsx`. */
const HUB_SHEET_PATHS = ['/quick-open', '/companion', '/new-worktree'] as const

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
 * Which shape this window and this route want.
 *
 * The rules, in the order they are applied:
 *
 *   1. **A narrow window is one column**, whatever route it is on. This is the iPad multitasking
 *      case, and it beats everything below — including a sheet, because a sheet cannot make room
 *      the window does not have.
 *   2. **A sheet changes nothing.** See `ShellLayoutDecision`.
 *   3. **The other three tabs are one column.** Terminals, Tasks and Settings are daemon-wide
 *      lists that own their whole width; a Worktree list beside Settings would be furniture.
 *   4. **The Hub root is one column.** The Worktree list IS that screen — putting the same list
 *      in a sidebar beside itself is the one layout that is strictly worse than the phone's.
 *   5. **Anything deeper in the Hub is a split.** A Worktree, a surface, a file: the screen that
 *      would have covered the list on a phone sits beside it instead, which is the web client's
 *      sidebar-and-viewer shape.
 */
export function decideShellLayout({
  pathname,
  width,
}: {
  pathname: string
  width: number
}): ShellLayoutDecision {
  if (width < SPLIT_MIN_WIDTH) return 'single'

  const path = normalize(pathname)

  if (HUB_SHEET_PATHS.some((sheet) => isUnder(path, sheet))) return 'unchanged'
  if (OTHER_TAB_PREFIXES.some((prefix) => isUnder(path, prefix))) return 'single'
  if (path === '/') return 'single'
  return 'split'
}
