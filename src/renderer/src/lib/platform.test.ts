import { afterEach, describe, expect, it } from 'vitest'
import { isCoarseTouch } from './platform'

/** jsdom's navigator has no maxTouchPoints setter — redefine the property per case. */
function setTouchPoints(value: number): void {
  Object.defineProperty(navigator, 'maxTouchPoints', { value, configurable: true })
}

describe('isCoarseTouch', () => {
  afterEach(() => {
    setTouchPoints(0)
  })

  it('is false on a pointer device (no touch points)', () => {
    setTouchPoints(0)
    expect(isCoarseTouch()).toBe(false)
  })

  it('is false for a single touch point (a pen/trackpad, not a multi-touch screen)', () => {
    setTouchPoints(1)
    expect(isCoarseTouch()).toBe(false)
  })

  it('is true on a multi-touch device (iPad/iPhone Safari)', () => {
    setTouchPoints(5)
    expect(isCoarseTouch()).toBe(true)
  })

  it('reads the device at call time, so a runtime change is honored', () => {
    setTouchPoints(0)
    expect(isCoarseTouch()).toBe(false)
    setTouchPoints(5)
    expect(isCoarseTouch()).toBe(true)
  })
})
