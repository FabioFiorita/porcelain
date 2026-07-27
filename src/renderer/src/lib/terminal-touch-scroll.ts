/**
 * Finger pan → terminal scroll for xterm 6.
 *
 * xterm scrolls via SmoothScrollableElement (wheel only) — iOS Safari never fires
 * wheel for finger pans, so without this adapter the buffer never moves. We convert
 * pointer/touch deltas into whole-line steps and apply them via applyTerminalTouchScroll.
 *
 * Convention matches xterm: positive lines = newer (scroll down), negative =
 * older scrollback (scroll up). Finger-down (dy > 0) therefore yields negative
 * lines; finger-up yields positive.
 *
 * Capture-phase listeners + touch-action:none (CSS on `.xterm` + wrapper) are
 * load-bearing: without capture, an inner handler can swallow the event; without
 * touch-action:none Safari steals the gesture for page rubber-band and our
 * preventDefault on move is ignored.
 *
 * Alternate-buffer apps (Claude Code fullscreen) own their own scroll. NEVER send
 * arrow keys — Claude detects that as "scroll wheel is sending arrow keys" and
 * refuses to scroll. Prefer real wheel events (mouse protocol) or PageUp/PageDown.
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

/** What the touch-pan adapter needs from an xterm instance (testable without xterm). */
export interface TerminalTouchScrollTarget {
  bufferType: 'normal' | 'alternate'
  mouseTrackingMode: 'none' | 'x10' | 'vt200' | 'drag' | 'any'
  rows: number
  /** Cell height in CSS px — one wheel tick / line. */
  cellHeight: number
  scrollLines: (lines: number) => void
  /** Write bytes into the PTY as input (PageUp/PageDown sequences). */
  input: (data: string) => void
  /** Fire a synthetic wheel event at the terminal element (mouse-protocol path). */
  dispatchWheel: (deltaY: number) => void
}

/**
 * Apply a pan line-delta to a terminal.
 *
 * - Normal buffer: xterm scrollback via scrollLines only.
 * - Alternate buffer + mouse tracking: synthetic wheel events so the app gets real
 *   SGR wheel reports (what Claude Code wants for "mouse wheel scrolls a few lines").
 * - Alternate buffer, no mouse: PageUp/PageDown — never arrows (Claude rejects those).
 */
export function applyTerminalTouchScroll(target: TerminalTouchScrollTarget, lines: number): void {
  if (lines === 0) return

  if (target.bufferType !== 'alternate') {
    target.scrollLines(lines)
    return
  }

  // lines < 0 → older content → wheel up (deltaY < 0) / PageUp
  // lines > 0 → newer content → wheel down (deltaY > 0) / PageDown
  const count = Math.abs(lines)
  const deltaY = lines < 0 ? -target.cellHeight : target.cellHeight

  if (target.mouseTrackingMode !== 'none') {
    for (let i = 0; i < count; i++) {
      target.dispatchWheel(deltaY)
    }
    return
  }

  // PageUp = CSI 5 ~, PageDown = CSI 6 ~. One page step per ~¼ viewport of finger
  // travel so a flick isn't N half-screens.
  const pageSeq = lines < 0 ? '\x1b[5~' : '\x1b[6~'
  const chunk = Math.max(3, Math.floor(target.rows / 4) || 3)
  const steps = Math.max(1, Math.round(count / chunk))
  for (let i = 0; i < steps; i++) {
    target.input(pageSeq)
  }
}

/**
 * Attach pan listeners that scroll the terminal and swallow the gesture so the
 * browser page can't rubber-band. Returns a disposer. Only meaningful on
 * multi-touch devices; desktop keeps the wheel path untouched.
 *
 * Prefers Pointer Events (setPointerCapture keeps moves even off-element); falls
 * back to Touch Events for environments without pointer capture. Both use capture
 * so they win over xterm-internal handlers.
 */
export function attachTouchScroll(
  scrollLines: (lines: number) => void,
  cellHeight: () => number,
  el: HTMLElement,
): () => void {
  el.style.touchAction = 'none'

  let lastY = 0
  let tracking = false
  let residual = 0
  let activePointerId: number | null = null

  const applyDy = (y: number): void => {
    const dy = y - lastY
    lastY = y
    const applied = applyTouchScrollDelta(residual, dy, cellHeight())
    residual = applied.residual
    if (applied.lines !== 0) scrollLines(applied.lines)
  }

  const onPointerDown = (e: PointerEvent): void => {
    // Mouse still uses the native wheel path on desktop; only touch/pen pans.
    if (e.pointerType === 'mouse') return
    if (!e.isPrimary) return
    tracking = true
    activePointerId = e.pointerId
    lastY = e.clientY
    residual = 0
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // Capture can fail if the element left the tree mid-gesture — tracking still works
      // while the pointer stays over el.
    }
  }

  const onPointerMove = (e: PointerEvent): void => {
    if (!tracking || e.pointerId !== activePointerId) return
    // Required so Safari doesn't page-pan over us (needs touch-action:none too).
    e.preventDefault()
    applyDy(e.clientY)
  }

  const onPointerEnd = (e: PointerEvent): void => {
    if (e.pointerId !== activePointerId) return
    tracking = false
    activePointerId = null
    residual = 0
  }

  // Touch Event fallback: some WebViews still deliver touch* more reliably than pointer*.
  // Skip when a pointer session is already tracking so we don't double-apply.
  const onTouchStart = (e: TouchEvent): void => {
    if (activePointerId !== null) return
    if (e.touches.length !== 1) return
    tracking = true
    lastY = e.touches[0].clientY
    residual = 0
  }
  const onTouchMove = (e: TouchEvent): void => {
    if (activePointerId !== null) return
    if (!tracking || e.touches.length !== 1) return
    e.preventDefault()
    applyDy(e.touches[0].clientY)
  }
  const onTouchEnd = (): void => {
    if (activePointerId !== null) return
    tracking = false
    residual = 0
  }

  const optsCapture = { capture: true } as const
  const optsMove = { capture: true, passive: false } as const

  el.addEventListener('pointerdown', onPointerDown, optsCapture)
  el.addEventListener('pointermove', onPointerMove, optsMove)
  el.addEventListener('pointerup', onPointerEnd, optsCapture)
  el.addEventListener('pointercancel', onPointerEnd, optsCapture)
  el.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
  el.addEventListener('touchmove', onTouchMove, optsMove)
  el.addEventListener('touchend', onTouchEnd, optsCapture)
  el.addEventListener('touchcancel', onTouchEnd, optsCapture)

  return () => {
    el.removeEventListener('pointerdown', onPointerDown, optsCapture)
    el.removeEventListener('pointermove', onPointerMove, optsMove)
    el.removeEventListener('pointerup', onPointerEnd, optsCapture)
    el.removeEventListener('pointercancel', onPointerEnd, optsCapture)
    el.removeEventListener('touchstart', onTouchStart, { capture: true })
    el.removeEventListener('touchmove', onTouchMove, optsMove)
    el.removeEventListener('touchend', onTouchEnd, optsCapture)
    el.removeEventListener('touchcancel', onTouchEnd, optsCapture)
  }
}
