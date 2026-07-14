import { describe, expect, it, vi } from 'vitest'
import { applyTouchScrollDelta, attachTouchScroll } from './terminal-touch-scroll'

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
  function fire(el: HTMLElement, type: string, touches: { clientY: number }[]): void {
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

  it('scrolls whole lines and preventDefaults move', () => {
    const el = document.createElement('div')
    const scrollLines = vi.fn()
    const dispose = attachTouchScroll(scrollLines, () => 12, el)

    fire(el, 'touchstart', [{ clientY: 100 }])
    fire(el, 'touchmove', [{ clientY: 76 }]) // dy = -24 → +2 lines
    expect(scrollLines).toHaveBeenCalledWith(2)

    scrollLines.mockClear()
    fire(el, 'touchmove', [{ clientY: 100 }]) // dy = +24 → -2 lines
    expect(scrollLines).toHaveBeenCalledWith(-2)

    dispose()
  })

  it('ignores multi-touch and does nothing after dispose', () => {
    const el = document.createElement('div')
    const scrollLines = vi.fn()
    const dispose = attachTouchScroll(scrollLines, () => 12, el)

    fire(el, 'touchstart', [{ clientY: 100 }, { clientY: 110 }])
    fire(el, 'touchmove', [{ clientY: 50 }])
    expect(scrollLines).not.toHaveBeenCalled()

    fire(el, 'touchstart', [{ clientY: 100 }])
    dispose()
    fire(el, 'touchmove', [{ clientY: 50 }])
    expect(scrollLines).not.toHaveBeenCalled()
  })
})
