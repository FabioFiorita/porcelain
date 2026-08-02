import { describe, expect, it } from 'vitest'

import {
  deriveLayout,
  SIDE_PANE_MAX_WIDTH,
  SIDE_PANE_MIN_WIDTH,
  SPLIT_LAYOUT_MIN_HEIGHT,
  SPLIT_LAYOUT_MIN_WIDTH,
} from './layout'

describe('deriveLayout', () => {
  it.each([
    { height: 667, name: 'iPhone portrait', width: 375 },
    { height: 375, name: 'iPhone landscape', width: 667 },
    { height: 599, name: 'short wide window', width: 1_024 },
    { height: 1_024, name: 'narrow tall window', width: 719 },
  ])('keeps a $name in the compact layout', ({ height, width }) => {
    expect(deriveLayout({ height, width })).toEqual({
      sidePaneWidth: null,
      usesSplitView: false,
    })
  })

  it('switches only when both split dimensions are available', () => {
    expect(
      deriveLayout({ height: SPLIT_LAYOUT_MIN_HEIGHT, width: SPLIT_LAYOUT_MIN_WIDTH }),
    ).toEqual({ sidePaneWidth: SIDE_PANE_MIN_WIDTH, usesSplitView: true })
    expect(
      deriveLayout({ height: SPLIT_LAYOUT_MIN_HEIGHT, width: SPLIT_LAYOUT_MIN_WIDTH - 1 }),
    ).toEqual({ sidePaneWidth: null, usesSplitView: false })
    expect(
      deriveLayout({ height: SPLIT_LAYOUT_MIN_HEIGHT - 1, width: SPLIT_LAYOUT_MIN_WIDTH }),
    ).toEqual({ sidePaneWidth: null, usesSplitView: false })
  })

  it('clamps the side pane to 32 percent between 280 and 380 points', () => {
    expect(deriveLayout({ height: 768, width: 1_024 }).sidePaneWidth).toBe(328)
    expect(deriveLayout({ height: 1_000, width: 1_600 }).sidePaneWidth).toBe(SIDE_PANE_MAX_WIDTH)
    expect(deriveLayout({ height: 1_000, width: 720 }).sidePaneWidth).toBe(SIDE_PANE_MIN_WIDTH)
  })
})
