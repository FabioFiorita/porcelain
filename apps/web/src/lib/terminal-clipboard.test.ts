import { describe, expect, it } from 'vitest'
import { isTerminalImageMime, terminalPasteKind } from './terminal-clipboard'

describe('terminal clipboard policy', () => {
  it('uses an image attachment in preference to browser-generated text alternatives', () => {
    expect(
      terminalPasteKind({
        text: 'file:///clipboard.png',
        image: { mime: 'image/png', dataBase64: 'YWJj' },
      }),
    ).toBe('image')
  })

  it('keeps text as terminal text when no image is present', () => {
    expect(terminalPasteKind({ text: 'git status', image: null })).toBe('text')
  })

  it('does not turn a missing image into a text paste for the explicit image command', () => {
    expect(terminalPasteKind({ text: 'git status', image: null }, true)).toBe('empty')
  })

  it('accepts only daemon-supported image types', () => {
    expect(isTerminalImageMime('image/png')).toBe(true)
    expect(isTerminalImageMime('image/svg+xml')).toBe(false)
  })
})
