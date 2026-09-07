import { describe, expect, it } from 'vitest'
import { menuInsets } from './menu-insets'

describe('menu window boundaries', () => {
  it.each([
    [
      { width: 1366, height: 1024 },
      { width: 900, height: 700 },
    ],
    [
      { width: 1366, height: 1024 },
      { width: 600, height: 900 },
    ],
    [
      { width: 1024, height: 1366 },
      { width: 800, height: 1100 },
    ],
    [
      { width: 390, height: 844 },
      { width: 390, height: 810 },
    ],
  ])('constrains screen-based collision detection to the app window', (screen, window) => {
    const insets = menuInsets(screen, window)
    expect(screen.width - insets.right).toBe(window.width - 12)
    expect(screen.height - insets.bottom).toBe(window.height - 12)
    expect(insets.left).toBe(12)
    expect(insets.top).toBe(12)
  })
})
