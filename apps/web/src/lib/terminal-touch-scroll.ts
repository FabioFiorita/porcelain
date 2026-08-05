import { applyTouchScrollDelta } from '@porcelain/client-runtime/terminal-touch-scroll'

/**
 * The DOM half of finger-pan scrolling. The rules themselves — line deltas, the alternate
 * buffer's SGR-wheel / PageUp fallback, and the ban on arrow keys — are shared with the mobile
 * client in `@porcelain/client-runtime/terminal-touch-scroll`; only the listener plumbing is
 * host-specific and lives here.
 *
 * Capture-phase listeners + touch-action:none (CSS on `.xterm` + wrapper) are load-bearing:
 * without capture, an inner handler can swallow the event; without touch-action:none Safari
 * steals the gesture for page rubber-band and our preventDefault on move is ignored.
 */

export {
  applyTerminalTouchScroll,
  applyTouchScrollDelta,
  encodeSgrWheel,
  mouseModeHasWheel,
  type TerminalTouchScrollTarget,
} from '@porcelain/client-runtime/terminal-touch-scroll'

/**
 * Attach pan listeners that scroll the terminal and swallow the gesture so the browser page
 * can't rubber-band. Returns a disposer. Only meaningful on multi-touch devices; desktop keeps
 * the wheel path untouched. Prefers Pointer Events (setPointerCapture keeps moves even
 * off-element), falling back to Touch Events without pointer capture — both use capture so they
 * win over xterm-internal handlers.
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
    const touch = e.touches[0]
    if (!touch) return
    tracking = true
    lastY = touch.clientY
    residual = 0
  }
  const onTouchMove = (e: TouchEvent): void => {
    if (activePointerId !== null) return
    if (!tracking || e.touches.length !== 1) return
    const touch = e.touches[0]
    if (!touch) return
    e.preventDefault()
    applyDy(touch.clientY)
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
