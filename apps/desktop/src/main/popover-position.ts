/**
 * Where the tray popover lands, as pure arithmetic — the one part of the menu-bar
 * feature that can be checked without a window server.
 *
 * The tray rectangle is the only anchor we get, and it is NOT always real: macOS and
 * Windows report the icon's screen rect, but Linux status-notifier hosts (GNOME's
 * AppIndicator) report all zeroes because the icon is drawn by the shell, not by us.
 * A zero rect must therefore fall back to a corner of the work area instead of pinning
 * the popover to the top-left of the display.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

/** Breathing room between the icon (or the screen edge) and the popover. */
const GAP = 6

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

/** True for the all-zero rectangle a status-notifier tray reports on Linux. */
export function isAnchorlessTray(tray: Rect | null): boolean {
  return tray === null || (tray.width === 0 && tray.height === 0)
}

/**
 * Top-left for a popover of `size`, anchored under (or above) the tray icon and kept
 * inside `workArea`. Without a usable anchor it sits in the work area's top-right
 * corner — where a menu-bar popover belongs on every platform we ship.
 */
export function popoverPosition(input: { tray: Rect | null; workArea: Rect; size: Size }): {
  x: number
  y: number
} {
  const { tray, workArea, size } = input
  const minX = workArea.x + GAP
  const maxX = workArea.x + workArea.width - size.width - GAP
  const minY = workArea.y + GAP
  const maxY = workArea.y + workArea.height - size.height - GAP

  // Narrowed inline rather than through `isAnchorlessTray`: a helper call does not
  // teach TypeScript that `tray` is non-null below.
  if (tray === null || isAnchorlessTray(tray)) {
    return { x: Math.round(clamp(maxX, minX, maxX)), y: Math.round(clamp(minY, minY, maxY)) }
  }

  const centered = tray.x + tray.width / 2 - size.width / 2
  // Below the icon for a top menu bar; above it when the tray sits on a bottom taskbar
  // and there is no room underneath.
  const below = tray.y + tray.height + GAP
  const y = below + size.height <= workArea.y + workArea.height ? below : tray.y - size.height - GAP
  return {
    x: Math.round(clamp(centered, minX, maxX)),
    y: Math.round(clamp(y, minY, maxY)),
  }
}
