import { describe, expect, it, vi } from 'vitest'
import {
  applyTerminalTouchScroll,
  applyTouchScrollDelta,
  attachTouchScroll,
  type TerminalTouchScrollTarget,
} from './terminal-touch-scroll'

function mockTarget(
  partial: Partial<TerminalTouchScrollTarget> &
    Pick<TerminalTouchScrollTarget, 'bufferType' | 'mouseTrackingMode'>,
): {
  target: TerminalTouchScrollTarget
  scrollLines: ReturnType<typeof vi.fn<(lines: number) => void>>
  input: ReturnType<typeof vi.fn<(data: string) => void>>
  dispatchWheel: ReturnType<typeof vi.fn<(deltaY: number) => void>>
} {
  const scrollLines = vi.fn<(lines: number) => void>()
  const input = vi.fn<(data: string) => void>()
  const dispatchWheel = vi.fn<(deltaY: number) => void>()
  return {
    target: {
      rows: 24,
      cellHeight: 12,
      scrollLines,
      input,
      dispatchWheel,
      ...partial,
    },
    scrollLines,
    input,
    dispatchWheel,
  }
}

describe('applyTerminalTouchScroll', () => {
  it('normal buffer only uses scrollLines — never keys or wheel', () => {
    const { target, scrollLines, input, dispatchWheel } = mockTarget({
      bufferType: 'normal',
      mouseTrackingMode: 'none',
    })
    applyTerminalTouchScroll(target, -3)
    expect(scrollLines).toHaveBeenCalledWith(-3)
    expect(input).not.toHaveBeenCalled()
    expect(dispatchWheel).not.toHaveBeenCalled()
  })

  it('alternate + mouse tracking dispatches wheel, never arrows', () => {
    const { target, scrollLines, input, dispatchWheel } = mockTarget({
      bufferType: 'alternate',
      mouseTrackingMode: 'any',
    })
    applyTerminalTouchScroll(target, -2) // older → negative deltaY
    expect(scrollLines).not.toHaveBeenCalled()
    expect(input).not.toHaveBeenCalled()
    expect(dispatchWheel).toHaveBeenCalledTimes(2)
    expect(dispatchWheel).toHaveBeenCalledWith(-12)
  })

  it('alternate without mouse uses PageUp/PageDown, never arrows', () => {
    const { target, scrollLines, input, dispatchWheel } = mockTarget({
      bufferType: 'alternate',
      mouseTrackingMode: 'none',
      rows: 24,
    })
    applyTerminalTouchScroll(target, -6)
    expect(scrollLines).not.toHaveBeenCalled()
    expect(dispatchWheel).not.toHaveBeenCalled()
    // PageUp, not CSI A / ESC O A
    expect(input).toHaveBeenCalled()
    for (const [seq] of input.mock.calls) {
      expect(seq).toBe('\x1b[5~')
      expect(seq).not.toMatch(/[AB]$/)
    }
  })

  it('alternate without mouse PageDown for newer content', () => {
    const { target, input } = mockTarget({ bufferType: 'alternate', mouseTrackingMode: 'none' })
    applyTerminalTouchScroll(target, 4)
    for (const [seq] of input.mock.calls) {
      expect(seq).toBe('\x1b[6~')
    }
  })
})

describe('applyTouchScrollDelta', () => {
  it('accumulates sub-cell moves without scrolling', () => {
    const a = applyTouchScrollDelta(0, 5, 12)
    expect(a).toEqual({ residual: -5, lines: 0 })
    const b = applyTouchScrollDelta(a.residual, 5, 12)
    expect(b).toEqual({ residual: -10, lines: 0 })
  })

  it('finger-down yields negative lines (older scrollback)', () => {
    // 24px down with 12px cells → 2 lines of older content
    expect(applyTouchScrollDelta(0, 24, 12)).toEqual({ residual: 0, lines: -2 })
  })

  it('finger-up yields positive lines (newer content)', () => {
    expect(applyTouchScrollDelta(0, -36, 12)).toEqual({ residual: 0, lines: 3 })
  })

  it('keeps residual after emitting whole lines', () => {
    // 30px down → -2 lines, residual -6
    expect(applyTouchScrollDelta(0, 30, 12)).toEqual({ residual: -6, lines: -2 })
  })

  it('carries residual across calls', () => {
    const a = applyTouchScrollDelta(0, 8, 12) // residual -8
    const b = applyTouchScrollDelta(a.residual, 8, 12) // residual -16 → lines -1, residual -4
    expect(b).toEqual({ residual: -4, lines: -1 })
  })

  it('returns zero lines when cellHeight is non-positive', () => {
    expect(applyTouchScrollDelta(0, 24, 0)).toEqual({ residual: -24, lines: 0 })
    expect(applyTouchScrollDelta(0, 24, -1)).toEqual({ residual: -24, lines: 0 })
  })
})

describe('attachTouchScroll', () => {
  function fireTouch(el: HTMLElement, type: string, touches: { clientY: number }[]): void {
    const list = touches.map((t, i) => ({
      identifier: i,
      clientY: t.clientY,
      clientX: 0,
      pageX: 0,
      pageY: t.clientY,
      screenX: 0,
      screenY: 0,
      target: el,
      force: 1,
      radiusX: 0,
      radiusY: 0,
      rotationAngle: 0,
    })) as unknown as Touch[]
    const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent
    Object.defineProperty(event, 'touches', { value: list })
    Object.defineProperty(event, 'changedTouches', { value: list })
    el.dispatchEvent(event)
  }

  function firePointer(
    el: HTMLElement,
    type: string,
    init: { clientY: number; pointerId?: number; pointerType?: string },
  ): void {
    const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
    Object.defineProperty(event, 'clientY', { value: init.clientY })
    Object.defineProperty(event, 'clientX', { value: 0 })
    Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 })
    Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'touch' })
    Object.defineProperty(event, 'isPrimary', { value: true })
    el.dispatchEvent(event)
  }

  it('scrolls whole lines from touch events and preventDefaults move', () => {
    const el = document.createElement('div')
    const scrollLines = vi.fn()
    const dispose = attachTouchScroll(scrollLines, () => 12, el)

    fireTouch(el, 'touchstart', [{ clientY: 100 }])
    fireTouch(el, 'touchmove', [{ clientY: 76 }]) // dy = -24 → +2 lines
    expect(scrollLines).toHaveBeenCalledWith(2)

    scrollLines.mockClear()
    fireTouch(el, 'touchmove', [{ clientY: 100 }]) // dy = +24 → -2 lines
    expect(scrollLines).toHaveBeenCalledWith(-2)

    dispose()
  })

  it('scrolls from pointer events (primary path on modern iOS)', () => {
    const el = document.createElement('div')
    // jsdom has no setPointerCapture — stub so the handler doesn't throw.
    el.setPointerCapture = vi.fn()
    const scrollLines = vi.fn()
    const dispose = attachTouchScroll(scrollLines, () => 12, el)

    firePointer(el, 'pointerdown', { clientY: 100 })
    firePointer(el, 'pointermove', { clientY: 76 })
    expect(scrollLines).toHaveBeenCalledWith(2)

    dispose()
  })

  it('ignores mouse pointers (desktop keeps the wheel path)', () => {
    const el = document.createElement('div')
    el.setPointerCapture = vi.fn()
    const scrollLines = vi.fn()
    const dispose = attachTouchScroll(scrollLines, () => 12, el)

    firePointer(el, 'pointerdown', { clientY: 100, pointerType: 'mouse' })
    firePointer(el, 'pointermove', { clientY: 50, pointerType: 'mouse' })
    expect(scrollLines).not.toHaveBeenCalled()

    dispose()
  })

  it('ignores multi-touch and does nothing after dispose', () => {
    const el = document.createElement('div')
    const scrollLines = vi.fn()
    const dispose = attachTouchScroll(scrollLines, () => 12, el)

    fireTouch(el, 'touchstart', [{ clientY: 100 }, { clientY: 110 }])
    fireTouch(el, 'touchmove', [{ clientY: 50 }])
    expect(scrollLines).not.toHaveBeenCalled()

    fireTouch(el, 'touchstart', [{ clientY: 100 }])
    dispose()
    fireTouch(el, 'touchmove', [{ clientY: 50 }])
    expect(scrollLines).not.toHaveBeenCalled()
  })
})
