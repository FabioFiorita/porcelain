import { describe, expect, it, vi } from 'vitest'
import { attachTouchScroll } from './terminal-touch-scroll'

/** The DOM listener plumbing only — the scroll rules are covered in @porcelain/client-runtime. */
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
    fireTouch(el, 'touchmove', [{ clientY: 76 }])
    expect(scrollLines).toHaveBeenCalledWith(2)

    scrollLines.mockClear()
    fireTouch(el, 'touchmove', [{ clientY: 100 }])
    expect(scrollLines).toHaveBeenCalledWith(-2)

    dispose()
  })

  it('scrolls from pointer events (primary path on modern iOS)', () => {
    const el = document.createElement('div')
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
