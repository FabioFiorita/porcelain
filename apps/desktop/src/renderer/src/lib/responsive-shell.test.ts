import { describe, expect, it } from 'vitest'
import {
  decideResponsiveLayout,
  type PanelState,
  type ShellWidths,
  viewerWidth,
} from './responsive-shell'

// A realistic-ish set of widths: 256px left panel, 80px rail, 272px right panel,
// 16px chrome, 384px viewer minimum. With both panels open the viewer needs
// 256 + 272 + 16 + 384 = 928px of window to stay at its minimum.
const widths = (windowWidth: number): ShellWidths => ({
  windowWidth,
  leftPanelWidth: 256,
  leftRailWidth: 80,
  rightPanelWidth: 272,
  chrome: 16,
  viewerMinWidth: 384,
})

const state = (partial: Partial<PanelState> = {}): PanelState => ({
  leftOpen: true,
  rightOpen: true,
  autoCollapsedLeft: false,
  autoClosedRight: false,
  ...partial,
})

describe('viewerWidth', () => {
  it('subtracts the open panels and chrome; rail width when the left is collapsed', () => {
    expect(viewerWidth(widths(1000), true, true)).toBe(1000 - 256 - 272 - 16)
    expect(viewerWidth(widths(1000), false, true)).toBe(1000 - 80 - 272 - 16)
    expect(viewerWidth(widths(1000), true, false)).toBe(1000 - 256 - 0 - 16)
    expect(viewerWidth(widths(1000), false, false)).toBe(1000 - 80 - 0 - 16)
  })
})

describe('decideResponsiveLayout — narrowing gives way in order', () => {
  it('keeps both panels when the window is wide enough', () => {
    const next = decideResponsiveLayout(widths(1200), state(), 1300)
    expect(next).toEqual(state())
  })

  it('closes the right Quick Access first when the viewer would drop below min', () => {
    // 900px: both open leaves 356 (< 384). Closing right leaves 628 (>= 384).
    const next = decideResponsiveLayout(widths(900), state(), 1000)
    expect(next.rightOpen).toBe(false)
    expect(next.autoClosedRight).toBe(true)
    expect(next.leftOpen).toBe(true)
    expect(next.autoCollapsedLeft).toBe(false)
  })

  it('collapses the left rail only when closing the right was not enough', () => {
    // 700px: right closed leaves 700-256-16 = 428 (>= 384), so left stays.
    expect(decideResponsiveLayout(widths(700), state(), 800).leftOpen).toBe(true)
    // 650px: right closed leaves 378 (< 384) → collapse left too → 554 (>= 384).
    const next = decideResponsiveLayout(widths(650), state(), 800)
    expect(next.rightOpen).toBe(false)
    expect(next.autoClosedRight).toBe(true)
    expect(next.leftOpen).toBe(false)
    expect(next.autoCollapsedLeft).toBe(true)
  })

  it('lets the viewer squeeze below min once both panels are already given (tiny window)', () => {
    // 400px: rail + no right = 400-80-16 = 304 (< 384), but nothing left to give.
    const next = decideResponsiveLayout(widths(400), state(), 800)
    expect(next.leftOpen).toBe(false)
    expect(next.rightOpen).toBe(false)
  })

  it('treats the first measurement (prevWidth null) as a give-way pass', () => {
    const next = decideResponsiveLayout(widths(650), state(), null)
    expect(next.rightOpen).toBe(false)
    expect(next.leftOpen).toBe(false)
  })
})

describe('decideResponsiveLayout — widening restores only what the system closed', () => {
  it('restores the left panel before the right Quick Access', () => {
    const collapsed = state({
      leftOpen: false,
      rightOpen: false,
      autoCollapsedLeft: true,
      autoClosedRight: true,
    })
    // 1000px: restore left (needs left open + right closed = 728 >= 384), then
    // right (needs both open = 456 >= 384).
    const next = decideResponsiveLayout(widths(1000), collapsed, 650)
    expect(next.leftOpen).toBe(true)
    expect(next.autoCollapsedLeft).toBe(false)
    expect(next.rightOpen).toBe(true)
    expect(next.autoClosedRight).toBe(false)
  })

  it('restores the left panel but leaves the right closed when only the left fits', () => {
    const collapsed = state({
      leftOpen: false,
      rightOpen: false,
      autoCollapsedLeft: true,
      autoClosedRight: true,
    })
    // 700px: left open + right closed = 428 (>= 384) so left restores; both open
    // would be 156 (< 384) so right stays closed, still flagged for a later widen.
    const next = decideResponsiveLayout(widths(700), collapsed, 650)
    expect(next.leftOpen).toBe(true)
    expect(next.autoCollapsedLeft).toBe(false)
    expect(next.rightOpen).toBe(false)
    expect(next.autoClosedRight).toBe(true)
  })

  it('never reopens a panel the user closed (flag false)', () => {
    const userClosedRight = state({ rightOpen: false, autoClosedRight: false })
    const next = decideResponsiveLayout(widths(2000), userClosedRight, 900)
    expect(next.rightOpen).toBe(false)
    expect(next.autoClosedRight).toBe(false)
  })
})

describe('decideResponsiveLayout — same width is a no-op (politeness)', () => {
  it('does not re-collapse a panel the user opened while narrow', () => {
    // Window is narrow (both open would be 356 < 384) but the width did not
    // change, so a user-opened panel is left alone until a further decrease.
    const userOpened = state()
    const next = decideResponsiveLayout(widths(900), userOpened, 900)
    expect(next).toEqual(userOpened)
  })

  it('re-collapses on a further width decrease after the user opened it', () => {
    const next = decideResponsiveLayout(widths(899), state(), 900)
    expect(next.rightOpen).toBe(false)
    expect(next.autoClosedRight).toBe(true)
  })
})
