import { describe, expect, it } from 'vitest'
import { isAnchorlessTray, popoverPosition } from './popover-position'

const SIZE = { width: 400, height: 300 }
const MENU_BAR_DISPLAY = { x: 0, y: 25, width: 1440, height: 875 }

describe('popoverPosition', () => {
  it('centers under a macOS menu-bar icon', () => {
    const position = popoverPosition({
      tray: { x: 1000, y: 0, width: 24, height: 24 },
      workArea: MENU_BAR_DISPLAY,
      size: SIZE,
    })
    expect(position).toEqual({ x: 812, y: 31 })
  })

  it('keeps a popover anchored near the right edge on screen', () => {
    const position = popoverPosition({
      tray: { x: 1420, y: 0, width: 24, height: 24 },
      workArea: MENU_BAR_DISPLAY,
      size: SIZE,
    })
    expect(position.x + SIZE.width).toBeLessThanOrEqual(MENU_BAR_DISPLAY.width)
  })

  it('flips above a bottom taskbar icon', () => {
    const position = popoverPosition({
      tray: { x: 1200, y: 1020, width: 24, height: 24 },
      workArea: { x: 0, y: 0, width: 1920, height: 1020 },
      size: SIZE,
    })
    expect(position.y).toBe(1020 - 300 - 6)
    expect(position.y + SIZE.height).toBeLessThanOrEqual(1020)
  })

  it('falls back to the work area corner for a status-notifier tray that reports zeroes', () => {
    // GNOME AppIndicator: the icon is drawn by the shell, so `tray.getBounds()` is 0,0,0,0.
    const zeroed = { x: 0, y: 0, width: 0, height: 0 }
    expect(isAnchorlessTray(zeroed)).toBe(true)
    expect(popoverPosition({ tray: zeroed, workArea: MENU_BAR_DISPLAY, size: SIZE })).toEqual({
      x: 1034,
      y: 31,
    })
  })

  it('falls back the same way with no tray rectangle at all (the app-menu path)', () => {
    expect(isAnchorlessTray(null)).toBe(true)
    expect(popoverPosition({ tray: null, workArea: MENU_BAR_DISPLAY, size: SIZE })).toEqual({
      x: 1034,
      y: 31,
    })
  })
})
