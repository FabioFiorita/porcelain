// Pure decision logic for the responsive app shell: given the window/panel
// widths and the current open states, decide whether the left sidebar and the
// right Quick Access panel should give way so the center viewer keeps a usable
// minimum width. The DOM listener that feeds this lives in
// `hooks/use-responsive-shell.ts`; everything below is side-effect-free so it can
// be unit-tested on its own.

/** Widths (px) needed to decide whether the center viewer still fits. */
export interface ShellWidths {
  windowWidth: number
  /** Horizontal space the left sidebar reserves with its content panel open. */
  leftPanelWidth: number
  /** Horizontal space the left sidebar reserves collapsed to the icon rail. */
  leftRailWidth: number
  /** Horizontal space the right Quick Access panel reserves when open. */
  rightPanelWidth: number
  /** Fixed chrome (inter-tile gaps) outside the three columns. */
  chrome: number
  /** The smallest the center viewer may become before panels must give way. */
  viewerMinWidth: number
}

export interface PanelState {
  leftOpen: boolean
  rightOpen: boolean
  /** The left panel is collapsed because the SYSTEM did it (restore on widen). */
  autoCollapsedLeft: boolean
  /** The right panel is closed because the SYSTEM did it (restore on widen). */
  autoClosedRight: boolean
}

/** Width the center viewer would get with the given panels open. */
export function viewerWidth(widths: ShellWidths, leftOpen: boolean, rightOpen: boolean): number {
  return (
    widths.windowWidth -
    (leftOpen ? widths.leftPanelWidth : widths.leftRailWidth) -
    (rightOpen ? widths.rightPanelWidth : 0) -
    widths.chrome
  )
}

/**
 * Decide the next panel layout. Narrowing (or first measurement, `prevWidth === null`):
 * give way in order — right Quick Access closes, then left sidebar collapses — until the
 * viewer meets its minimum, flagging each auto-closed panel for later restore. Widening:
 * restore only flagged panels, left before right, only while the viewer keeps its minimum.
 * Same width (a toggle or width-var change, not a resize): no automatic change — a panel
 * opened while narrow stays open until a further decrease.
 */
export function decideResponsiveLayout(
  widths: ShellWidths,
  current: PanelState,
  prevWidth: number | null,
): PanelState {
  let { leftOpen, rightOpen, autoCollapsedLeft, autoClosedRight } = current
  const fits = (l: boolean, r: boolean): boolean =>
    viewerWidth(widths, l, r) >= widths.viewerMinWidth

  if (prevWidth !== null && widths.windowWidth > prevWidth) {
    // Widening — restore, left panel before right Quick Access.
    if (autoCollapsedLeft && fits(true, rightOpen)) {
      leftOpen = true
      autoCollapsedLeft = false
    }
    if (autoClosedRight && fits(leftOpen, true)) {
      rightOpen = true
      autoClosedRight = false
    }
  } else if (prevWidth === null || widths.windowWidth < prevWidth) {
    // Narrowing / first run — give way, right Quick Access before left panel.
    if (!fits(leftOpen, rightOpen) && rightOpen) {
      rightOpen = false
      autoClosedRight = true
    }
    if (!fits(leftOpen, rightOpen) && leftOpen) {
      leftOpen = false
      autoCollapsedLeft = true
    }
  }

  return { leftOpen, rightOpen, autoCollapsedLeft, autoClosedRight }
}
