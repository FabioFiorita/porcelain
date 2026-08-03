import { describe, expect, it } from 'vitest'
import { controlByte, type EditChord, terminalArrowBytes, terminalEditBytes } from './terminal-keys'

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

  it('maps ⇧↵ and ⌘↵ to Meta+Enter (ESC CR), the legacy newline — not a bare LF, which submits', () => {
    expect(terminalEditBytes(chord({ key: 'Enter', shiftKey: true }))).toBe('\x1b\r')
    expect(terminalEditBytes(chord({ key: 'Enter', metaKey: true }))).toBe('\x1b\r')
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

describe('controlByte', () => {
  it('maps the chords a shell is unusable without', () => {
    expect(controlByte('c')).toBe('\x03') // interrupt
    expect(controlByte('d')).toBe('\x04') // EOF
    expect(controlByte('z')).toBe('\x1a') // suspend
    expect(controlByte('a')).toBe('\x01') // start of line
    expect(controlByte('e')).toBe('\x05') // end of line
    expect(controlByte('l')).toBe('\x0c') // clear
    expect(controlByte('r')).toBe('\x12') // reverse search
  })

  it('is case-insensitive, so an autocapitalized soft-keyboard letter still works', () => {
    expect(controlByte('C')).toBe(controlByte('c'))
    expect(controlByte('D')).toBe('\x04')
  })

  it('covers the non-letter conventions', () => {
    expect(controlByte('[')).toBe('\x1b') // Ctrl-[ is Escape
    expect(controlByte('?')).toBe('\x7f') // Ctrl-? is DEL
    expect(controlByte(' ')).toBe('\x00') // Ctrl-Space is NUL
    expect(controlByte('@')).toBe('\x00')
  })

  it('returns null for keys that have no control form, so xterm keeps handling them', () => {
    expect(controlByte('Enter')).toBeNull()
    expect(controlByte('ArrowUp')).toBeNull()
    expect(controlByte('Shift')).toBeNull()
    expect(controlByte('')).toBeNull()
    expect(controlByte('1')).toBeNull()
  })
})

describe('terminalArrowBytes', () => {
  it('sends the normal-mode CSI form when the app has not set DECCKM', () => {
    expect(terminalArrowBytes('up', false)).toBe('\x1b[A')
    expect(terminalArrowBytes('down', false)).toBe('\x1b[B')
    expect(terminalArrowBytes('right', false)).toBe('\x1b[C')
    expect(terminalArrowBytes('left', false)).toBe('\x1b[D')
  })

  it('switches to SS3 in application-cursor mode, or vim would insert a literal [A', () => {
    expect(terminalArrowBytes('up', true)).toBe('\x1bOA')
    expect(terminalArrowBytes('down', true)).toBe('\x1bOB')
    expect(terminalArrowBytes('right', true)).toBe('\x1bOC')
    expect(terminalArrowBytes('left', true)).toBe('\x1bOD')
  })
})
