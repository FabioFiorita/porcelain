import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeOsc52Payload, osc52WriteText } from './terminal-osc52'

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

describe('attachOsc52Clipboard', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('registers an OSC 52 handler that copies decoded text', async () => {
    const copySpy = vi.fn().mockResolvedValue(undefined)
    vi.doMock('./utils', () => ({ copyText: copySpy }))
    const { attachOsc52Clipboard } = await import('./terminal-osc52')

    let handler: ((data: string) => boolean) | undefined
    const term = {
      parser: {
        registerOscHandler: (id: number, cb: (data: string) => boolean) => {
          expect(id).toBe(52)
          handler = cb
          return { dispose: () => {} }
        },
      },
    }
    attachOsc52Clipboard(term as never)
    expect(handler).toBeTypeOf('function')
    expect(handler?.(`c;${b64('yanked')}`)).toBe(true)
    // microtask: void copyText(...)
    await Promise.resolve()
    expect(copySpy).toHaveBeenCalledWith('yanked')
  })
})
