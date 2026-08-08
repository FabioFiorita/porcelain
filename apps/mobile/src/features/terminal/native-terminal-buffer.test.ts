import { describe, expect, it } from 'vitest'

import { MAX_NATIVE_BUFFER_CODE_UNITS, NativeTerminalBuffer } from './native-terminal-buffer'

describe('NativeTerminalBuffer', () => {
  it('replaces live output with the authoritative reconnect snapshot', () => {
    const buffer = new NativeTerminalBuffer()
    buffer.append('before disconnect')
    buffer.replace('authoritative replay')
    expect(buffer.value()).toBe('authoritative replay')
  })

  it('keeps a noisy PTY bounded, including a single oversized frame', () => {
    const buffer = new NativeTerminalBuffer()
    buffer.append('x'.repeat(MAX_NATIVE_BUFFER_CODE_UNITS + 100_000))
    expect(buffer.value()).toHaveLength(MAX_NATIVE_BUFFER_CODE_UNITS)
  })
})
