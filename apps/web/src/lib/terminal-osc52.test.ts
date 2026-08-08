import { describe, expect, it } from 'vitest'
import { decodeOsc52Payload, Osc52StreamFilter, osc52WriteText } from './terminal-osc52'

function b64(text: string): string {
  // Mirror the OSC 52 encode path: UTF-8 bytes → Latin-1 string → base64.
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

describe('decodeOsc52Payload', () => {
  it('decodes ASCII and UTF-8 text', () => {
    expect(decodeOsc52Payload(b64('hello'))).toBe('hello')
    expect(decodeOsc52Payload(b64('café — 日本語'))).toBe('café — 日本語')
  })

  it('returns null for empty, query, or garbage', () => {
    expect(decodeOsc52Payload('')).toBeNull()
    expect(decodeOsc52Payload('?')).toBeNull()
    expect(decodeOsc52Payload('!!!not-base64!!!')).toBeNull()
  })

  it('tolerates whitespace in the base64 body', () => {
    const encoded = b64('spaced')
    const withNewlines = `${encoded.slice(0, 4)}\n${encoded.slice(4)}`
    expect(decodeOsc52Payload(withNewlines)).toBe('spaced')
  })
})

describe('osc52WriteText', () => {
  it('extracts system-clipboard writes', () => {
    expect(osc52WriteText(`c;${b64('from-claude')}`)).toBe('from-claude')
    // Empty selection = both clipboards; still write system.
    expect(osc52WriteText(`;${b64('both')}`)).toBe('both')
  })

  it('ignores primary, read queries, and clears', () => {
    expect(osc52WriteText(`p;${b64('primary')}`)).toBeNull()
    expect(osc52WriteText('c;?')).toBeNull()
    expect(osc52WriteText('c;')).toBeNull()
    expect(osc52WriteText('c')).toBeNull()
  })
})

describe('Osc52StreamFilter', () => {
  it('removes OSC 52 and writes its decoded contents across chunk boundaries', () => {
    const filter = new Osc52StreamFilter()
    const writes: string[] = []
    const payload = b64('copied from a remote TUI')
    expect(
      filter.process(`before\u001b]52;c;${payload.slice(0, 8)}`, (text) => writes.push(text)),
    ).toBe('before')
    expect(filter.process(`${payload.slice(8)}\u001b\\after`, (text) => writes.push(text))).toBe(
      'after',
    )
    expect(writes).toEqual(['copied from a remote TUI'])
  })

  it('accepts BEL termination and keeps non-OSC escape sequences intact', () => {
    const filter = new Osc52StreamFilter()
    const writes: string[] = []
    expect(
      filter.process(`\u001b[31mred\u001b]52;c;${b64('clipboard')}\u0007\u001b[0m`, (text) =>
        writes.push(text),
      ),
    ).toBe('\u001b[31mred\u001b[0m')
    expect(writes).toEqual(['clipboard'])
  })

  it('can replay output silently while still stripping a clipboard escape', () => {
    const filter = new Osc52StreamFilter()
    expect(filter.process(`prompt\u001b]52;c;${b64('must not replay')}\u0007`)).toBe('prompt')
  })
})
