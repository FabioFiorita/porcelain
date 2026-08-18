import { describe, expect, it } from 'vitest'
import { MAC_TRAFFIC_LIGHT_CLEARANCE, sidebarTopOffsetClass } from './shell-chrome'

describe('sidebarTopOffsetClass', () => {
  it('reserves the drawn titlebar row only for a frameless shell', () => {
    // 3rem is title-bar.tsx's h-12 row. A frameless window (Linux/Windows) is the only
    // client that draws one; macOS's traffic lights are native and the browser has no
    // window chrome, so both start at the true window top.
    expect(sidebarTopOffsetClass(true)).toContain('md:top-[calc(3rem+env(safe-area-inset-top))]')
    expect(sidebarTopOffsetClass(true)).toContain('100dvh-3rem-')

    expect(sidebarTopOffsetClass(false)).toBe(
      'md:top-[env(safe-area-inset-top)] md:h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))]',
    )
    expect(sidebarTopOffsetClass(false)).not.toContain('3rem')
  })

  it('keeps the safe-area terms on both branches, so the browser client clears the notch', () => {
    for (const frameless of [true, false]) {
      expect(sidebarTopOffsetClass(frameless)).toContain('env(safe-area-inset-top)')
      expect(sidebarTopOffsetClass(frameless)).toContain('env(safe-area-inset-bottom)')
    }
  })
})

describe('MAC_TRAFFIC_LIGHT_CLEARANCE', () => {
  it('clears trafficLightPosition x:19 plus the buttons (to roughly x:70)', () => {
    // Pinned as an assertion rather than a comment: the constant only works because
    // window.ts places the lights at x:19. If one moves, this is the pair that must move
    // together — 80px is the clearance, ~70px is what has to be cleared.
    expect(MAC_TRAFFIC_LIGHT_CLEARANCE).toBe('pl-20')
  })
})
