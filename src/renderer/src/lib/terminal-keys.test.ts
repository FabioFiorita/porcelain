import { describe, expect, it } from 'vitest'
import { type EditChord, terminalEditBytes } from './terminal-keys'

const chord = (partial: Partial<EditChord> & { key: string }): EditChord => ({
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...partial,
})

describe('terminalEditBytes', () => {
  it('maps ⌘ line-wise editing', () => {
    expect(terminalEditBytes(chord({ key: 'Backspace', metaKey: true }))).toBe('\x15')
    expect(terminalEditBytes(chord({ key: 'ArrowLeft', metaKey: true }))).toBe('\x01')
    expect(terminalEditBytes(chord({ key: 'ArrowRight', metaKey: true }))).toBe('\x05')
  })

  it('maps ⌥ word-wise editing', () => {
    expect(terminalEditBytes(chord({ key: 'Backspace', altKey: true }))).toBe('\x1b\x7f')
    expect(terminalEditBytes(chord({ key: 'ArrowLeft', altKey: true }))).toBe('\x1bb')
    expect(terminalEditBytes(chord({ key: 'ArrowRight', altKey: true }))).toBe('\x1bf')
  })

  it('maps ⇧↵ to a newline', () => {
    expect(terminalEditBytes(chord({ key: 'Enter', shiftKey: true }))).toBe('\n')
  })

  it('leaves plain keys and Ctrl/Option-compose alone', () => {
    expect(terminalEditBytes(chord({ key: 'Backspace' }))).toBeNull() // plain ⌫ → xterm default
    expect(terminalEditBytes(chord({ key: 'Enter' }))).toBeNull() // plain ↵ submits
    expect(terminalEditBytes(chord({ key: 'a', altKey: true }))).toBeNull() // ⌥ + letter composes
    expect(terminalEditBytes(chord({ key: 'Backspace', ctrlKey: true }))).toBeNull()
    expect(terminalEditBytes(chord({ key: 'ArrowLeft' }))).toBeNull()
  })

  it('ignores chords that add Shift to a ⌘/⌥ edit', () => {
    expect(terminalEditBytes(chord({ key: 'ArrowLeft', metaKey: true, shiftKey: true }))).toBeNull()
    expect(terminalEditBytes(chord({ key: 'Backspace', altKey: true, shiftKey: true }))).toBeNull()
  })
})
