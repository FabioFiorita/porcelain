import { describe, expect, it } from 'vitest'
import { hasMod, isModExclusive, kbdLabel } from './keyboard'

// window.porcelain is absent under jsdom, so the platform helpers default to macOS —
// these assert the macOS branch (the Linux branch is covered by the forced-Linux e2e).
describe('keyboard platform helpers (macOS default)', () => {
  it('hasMod treats Cmd as the primary modifier', () => {
    expect(hasMod({ metaKey: true, ctrlKey: false })).toBe(true)
    expect(hasMod({ metaKey: false, ctrlKey: true })).toBe(false)
  })

  it('isModExclusive requires Cmd without Ctrl', () => {
    expect(isModExclusive({ metaKey: true, ctrlKey: false })).toBe(true)
    expect(isModExclusive({ metaKey: true, ctrlKey: true })).toBe(false)
    expect(isModExclusive({ metaKey: false, ctrlKey: true })).toBe(false)
  })

  it('kbdLabel renders the macOS glyphs joined tight', () => {
    expect(kbdLabel('mod', 'K')).toBe('⌘K')
    expect(kbdLabel('mod', 'shift', 'F')).toBe('⌘⇧F')
    expect(kbdLabel('mod', '⌫')).toBe('⌘⌫')
    expect(kbdLabel('alt', '←')).toBe('⌥←')
  })
})
