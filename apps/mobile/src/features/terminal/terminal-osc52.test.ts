import { Terminal } from '@xterm/headless'
import { describe, expect, it } from 'vitest'

import { attachOsc52Clipboard, decodeOsc52Payload, osc52WriteText } from './terminal-osc52'

/**
 * The clipboard bridge, including its hand-rolled decode.
 *
 * Hermes has neither `atob` nor `TextDecoder`, so the decode is ours — which makes it exactly
 * the kind of code that has to be tested rather than trusted. The read path is asserted as
 * ignored, because "we deliberately do not implement it" is a security property, not an
 * omission someone should later fill in.
 */

/**
 * Encode a fixture the way a real agent would, independently of the decoder under test —
 * Node's own base64, not a mirror of the implementation.
 */
function base64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64')
}

describe('decodeOsc52Payload', () => {
  it('decodes ASCII', () => {
    expect(decodeOsc52Payload(base64('git status'))).toBe('git status')
  })

  it('decodes multi-byte UTF-8 — a diff is full of it', () => {
    const text = 'café → 日本語 🙂'
    expect(decodeOsc52Payload(base64(text))).toBe(text)
  })

  it('survives padding and embedded whitespace', () => {
    expect(decodeOsc52Payload(`${base64('ab')}`)).toBe('ab')
    expect(decodeOsc52Payload(` ${base64('abc')} `)).toBe('abc')
  })

  it('refuses a query, an empty payload and garbage', () => {
    expect(decodeOsc52Payload('?')).toBeNull()
    expect(decodeOsc52Payload('')).toBeNull()
    expect(decodeOsc52Payload('not base64!')).toBeNull()
  })
})

describe('osc52WriteText', () => {
  it('takes the system clipboard selection', () => {
    expect(osc52WriteText(`c;${base64('copied')}`)).toBe('copied')
  })

  it('takes the empty selection, which means "both"', () => {
    expect(osc52WriteText(`;${base64('copied')}`)).toBe('copied')
  })

  it('ignores the primary selection, which a phone has no equivalent for', () => {
    expect(osc52WriteText(`p;${base64('copied')}`)).toBeNull()
  })

  it('ignores a READ request — reporting the pasteboard into the PTY is exfiltration', () => {
    expect(osc52WriteText('c;?')).toBeNull()
  })

  it('ignores a clear and a malformed body', () => {
    expect(osc52WriteText('c;')).toBeNull()
    expect(osc52WriteText('nonsense')).toBeNull()
  })
})

describe('attachOsc52Clipboard against a live xterm', () => {
  it('copies what an agent emits, and prints nothing to the screen', async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 40, rows: 4 })
    const copied: string[] = []
    attachOsc52Clipboard(term, (text) => copied.push(text))
    await new Promise<void>((resolve) => {
      term.write(`\x1b]52;c;${base64('from the agent')}\x07`, resolve)
    })
    expect(copied).toEqual(['from the agent'])
    // The sequence is consumed by the handler rather than falling through as text.
    expect(term.buffer.active.getLine(0)?.translateToString(true)).toBe('')
  })

  it('does not copy for a read request', async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 40, rows: 4 })
    const copied: string[] = []
    attachOsc52Clipboard(term, (text) => copied.push(text))
    await new Promise<void>((resolve) => {
      term.write('\x1b]52;c;?\x07', resolve)
    })
    expect(copied).toEqual([])
  })
})
