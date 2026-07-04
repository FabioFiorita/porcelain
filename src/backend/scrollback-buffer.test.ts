import { describe, expect, it } from 'vitest'
import { ScrollbackBuffer } from './scrollback-buffer'

describe('ScrollbackBuffer', () => {
  it('is empty before anything is appended', () => {
    expect(new ScrollbackBuffer().snapshot()).toBe('')
  })

  it('accumulates chunks in order while under the cap', () => {
    const buffer = new ScrollbackBuffer(64)
    buffer.append('foo')
    buffer.append('bar')
    expect(buffer.snapshot()).toBe('foobar')
  })

  it('drops the oldest chunks once over the cap, keeping the newest', () => {
    const buffer = new ScrollbackBuffer(6)
    buffer.append('aaa')
    buffer.append('bbb')
    buffer.append('ccc')
    // 'aaa' is dropped to get back under 6 bytes; the two newest chunks remain.
    expect(buffer.snapshot()).toBe('bbbccc')
  })

  it('always keeps the last chunk even when it alone exceeds the cap', () => {
    const buffer = new ScrollbackBuffer(4)
    buffer.append('hello world')
    expect(buffer.snapshot()).toBe('hello world')
  })

  it('counts bytes, not characters, for multibyte content', () => {
    // '€' is 3 UTF-8 bytes, so two of them (6 bytes) blow a 4-byte cap and the
    // first is dropped.
    const buffer = new ScrollbackBuffer(4)
    buffer.append('€')
    buffer.append('€')
    expect(buffer.snapshot()).toBe('€')
  })
})
