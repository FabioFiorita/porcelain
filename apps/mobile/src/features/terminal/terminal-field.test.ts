import { describe, expect, it } from 'vitest'

import { FIELD_SENTINEL as S, terminalFieldEdit } from './terminal-field'

const BS = '\x7f'

describe('terminalFieldEdit', () => {
  it('sends only the character that was appended', () => {
    expect(terminalFieldEdit(S, `${S}e`)).toEqual({ bytes: 'e', value: `${S}e` })
  })

  it('sends one character per keystroke, never the accumulated line', () => {
    // The bug this exists for: without diffing, typing "echo" sent "e", "ec", "ech", "echo" and
    // the shell showed "eececheochoecho".
    let value = S
    const sent: string[] = []
    for (const char of 'echo') {
      const edit = terminalFieldEdit(value, `${value}${char}`)
      sent.push(edit.bytes)
      value = edit.value
    }
    expect(sent).toEqual(['e', 'c', 'h', 'o'])
  })

  it('sends a backspace per deleted character', () => {
    expect(terminalFieldEdit(`${S}abc`, `${S}a`).bytes).toBe(`${BS}${BS}`)
  })

  it('turns a replacement into deletions then insertions (autocorrect, dictation)', () => {
    const edit = terminalFieldEdit(`${S}teh`, `${S}the`)
    expect(edit.bytes).toBe(`${BS}${BS}he`)
  })

  it('submits a newline as a carriage return and starts the field over', () => {
    const edit = terminalFieldEdit(`${S}ls`, `${S}ls\n`)
    expect(edit.bytes).toBe('\r')
    // The line belongs to the shell now; keeping it would make the next Backspace try to erase
    // characters the shell has already consumed.
    expect(edit.value).toBe(S)
  })

  it('restores the sentinel when it is itself deleted, so the next Backspace is still visible', () => {
    const edit = terminalFieldEdit(S, '')
    expect(edit.bytes).toBe(BS)
    expect(edit.value).toBe(S)
  })

  it('sends a paste as one burst', () => {
    expect(terminalFieldEdit(S, `${S}git status`).bytes).toBe('git status')
  })

  it('does nothing when the field did not change', () => {
    expect(terminalFieldEdit(`${S}x`, `${S}x`)).toEqual({ bytes: '', value: `${S}x` })
  })

  it('handles a multi-line paste, submitting each line', () => {
    expect(terminalFieldEdit(S, `${S}a\nb\n`).bytes).toBe('a\rb\r')
  })
})
