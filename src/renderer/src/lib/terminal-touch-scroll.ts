/**
 * Pure math for converting finger pans into whole-line terminal scrolls.
 *
 * xterm 6 scrolls via VS Code's SmoothScrollableElement, which only listens for
 * wheel events — iOS Safari never fires those for finger pans. The registry turns
 * touchmove deltas into `term.scrollLines` via this accumulator so fractional
 * pixel moves don't get rounded away until they accumulate a full cell.
 *
 * Convention matches xterm: positive lines = newer (scroll down), negative =
 * older scrollback (scroll up). Finger-down (dy > 0) therefore yields negative
 * lines; finger-up yields positive.
 */
export function applyTouchScrollDelta(
  residual: number,
  dy: number,
  cellHeight: number,
): { residual: number; lines: number } {
  const next = residual - dy
  if (!(cellHeight > 0)) return { residual: next, lines: 0 }
  // Math.trunc(-0.4) is -0; normalize so callers never see negative zero.
  const lines = Math.trunc(next / cellHeight) || 0
  return { residual: next - lines * cellHeight, lines }
}

/**
 * Attach touch listeners that pan the xterm buffer and swallow the gesture so
 * the browser page can't rubber-band. Returns a disposer. Only meaningful on
 * multi-touch devices; desktop keeps the wheel path untouched.
 */
export function attachTouchScroll(
  scrollLines: (lines: number) => void,
  cellHeight: () => number,
  el: HTMLElement,
): () => void {
  let lastY = 0
  let tracking = false
  let residual = 0

  const onStart = (e: TouchEvent): void => {
    if (e.touches.length !== 1) return
    tracking = true
    lastY = e.touches[0].clientY
    residual = 0
  }
  const onMove = (e: TouchEvent): void => {
    if (!tracking || e.touches.length !== 1) return
    // Must be non-passive so we can stop the page pan.
    e.preventDefault()
    const y = e.touches[0].clientY
    const dy = y - lastY
    lastY = y
    const applied = applyTouchScrollDelta(residual, dy, cellHeight())
    residual = applied.residual
    if (applied.lines !== 0) scrollLines(applied.lines)
  }
  const onEnd = (): void => {
    tracking = false
  }

  el.addEventListener('touchstart', onStart, { passive: true })
  el.addEventListener('touchmove', onMove, { passive: false })
  el.addEventListener('touchend', onEnd, { passive: true })
  el.addEventListener('touchcancel', onEnd, { passive: true })

  return () => {
    el.removeEventListener('touchstart', onStart)
    el.removeEventListener('touchmove', onMove)
    el.removeEventListener('touchend', onEnd)
    el.removeEventListener('touchcancel', onEnd)
  }
}
