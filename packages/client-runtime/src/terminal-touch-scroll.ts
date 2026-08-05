/**
 * Finger pan → terminal scroll: the rules, without a host.
 *
 * A terminal only scrolls on a wheel, which no touch device sends, so every touch client has
 * to turn pan deltas into whole-line steps itself. The hard-won part is not the arithmetic but
 * what to do in the ALTERNATE buffer, where a full-screen app (Claude Code, vim, less) owns
 * the screen and there is no scrollback to move: send a real wheel report if the app asked for
 * mouse tracking, otherwise PageUp/PageDown — and NEVER arrow keys, which agents detect as
 * "the scroll wheel is sending arrow keys" and refuse.
 *
 * Both touch clients depend on these rules, so they live here rather than in either one. What
 * stays host-side is only the gesture plumbing: DOM pointer listeners on web, a pan recognizer
 * on native.
 *
 * Convention matches xterm: positive lines = newer (scroll down), negative = older scrollback.
 * Finger-down (dy > 0) therefore yields negative lines; finger-up yields positive.
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

/** What the touch-pan applier needs from a terminal (testable without one). */
export interface TerminalTouchScrollTarget {
  bufferType: 'normal' | 'alternate'
  mouseTrackingMode: 'none' | 'x10' | 'vt200' | 'drag' | 'any'
  cols: number
  rows: number
  scrollLines: (lines: number) => void
  /** Write bytes into the PTY as input (SGR wheel or PageUp/PageDown). */
  input: (data: string) => void
}

/**
 * SGR mouse wheel report (DECSET 1006). Button 64 = wheel up, 65 = wheel down.
 * col/row are 1-based. One report per notch — agents treat these as a real mouse wheel.
 */
export function encodeSgrWheel(lines: number, col: number, row: number): string {
  if (lines === 0) return ''
  // lines < 0 → older content → wheel up (64); lines > 0 → newer → wheel down (65)
  const code = lines < 0 ? 64 : 65
  const c = Math.max(1, col)
  const r = Math.max(1, row)
  const one = `\x1b[<${code};${c};${r}M`
  return one.repeat(Math.abs(lines))
}

/** Whether this mouse mode's protocol includes wheel events (X10 is press-only). */
export function mouseModeHasWheel(mode: TerminalTouchScrollTarget['mouseTrackingMode']): boolean {
  return mode === 'vt200' || mode === 'drag' || mode === 'any'
}

/**
 * Apply a pan line-delta to a terminal.
 *
 * - Normal buffer: scrollback via scrollLines only.
 * - Alternate + wheel-capable mouse: SGR wheel reports into the PTY.
 * - Alternate otherwise: PageUp/PageDown — never arrow keys.
 */
export function applyTerminalTouchScroll(target: TerminalTouchScrollTarget, lines: number): void {
  if (lines === 0) return

  if (target.bufferType !== 'alternate') {
    target.scrollLines(lines)
    return
  }

  // lines < 0 → older content → wheel up / PageUp
  // lines > 0 → newer content → wheel down / PageDown
  if (mouseModeHasWheel(target.mouseTrackingMode)) {
    const col = Math.max(1, Math.floor(target.cols / 2) + 1)
    const row = Math.max(1, Math.floor(target.rows / 2) + 1)
    const report = encodeSgrWheel(lines, col, row)
    if (report !== '') target.input(report)
    return
  }

  // PageUp = CSI 5 ~, PageDown = CSI 6 ~. One page step per ~¼ viewport of finger travel so a
  // flick isn't N half-screens.
  const pageSeq = lines < 0 ? '\x1b[5~' : '\x1b[6~'
  const chunk = Math.max(3, Math.floor(target.rows / 4) || 3)
  const steps = Math.max(1, Math.round(Math.abs(lines) / chunk))
  for (let i = 0; i < steps; i++) {
    target.input(pageSeq)
  }
}
