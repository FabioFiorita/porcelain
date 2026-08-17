import { describe, expect, it } from 'vitest'
import { canRevealInFinder } from './use-reveal-in-finder'

describe('canRevealInFinder', () => {
  it('is only true on a local shell', () => {
    expect(canRevealInFinder({ isBrowser: false, isLocal: true })).toBe(true)
  })

  it('is false in the browser, on a remote window, and while locality is unknown', () => {
    expect(canRevealInFinder({ isBrowser: true, isLocal: true })).toBe(false)
    expect(canRevealInFinder({ isBrowser: false, isLocal: false })).toBe(false)
    expect(canRevealInFinder({ isBrowser: false, isLocal: undefined })).toBe(false)
  })
})
