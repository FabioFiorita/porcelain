export const SPLIT_LAYOUT_MIN_WIDTH = 720
export const SPLIT_LAYOUT_MIN_HEIGHT = 600
export const SIDE_PANE_MIN_WIDTH = 280
export const SIDE_PANE_MAX_WIDTH = 380

export type Layout = {
  readonly usesSplitView: boolean
  readonly sidePaneWidth: number | null
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export function deriveLayout(input: { readonly width: number; readonly height: number }): Layout {
  const width = Number.isFinite(input.width) ? Math.max(0, input.width) : 0
  const height = Number.isFinite(input.height) ? Math.max(0, input.height) : 0

  if (width < SPLIT_LAYOUT_MIN_WIDTH || height < SPLIT_LAYOUT_MIN_HEIGHT) {
    return { sidePaneWidth: null, usesSplitView: false }
  }

  return {
    sidePaneWidth: clamp(Math.round(width * 0.32), SIDE_PANE_MIN_WIDTH, SIDE_PANE_MAX_WIDTH),
    usesSplitView: true,
  }
}
