import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  TERMINAL_OUTPUT_FLUSH_MS,
  TERMINAL_OUTPUT_MAX_BYTES,
  TerminalOutputBuffer,
} from './terminal-output-buffer'

afterEach(() => {
  vi.useRealTimers()
})

describe('TerminalOutputBuffer', () => {
  it('coalesces PTY bursts on the bridge flush interval', () => {
    vi.useFakeTimers()
    const output: string[] = []
    const buffer = new TerminalOutputBuffer((data) => output.push(data))

    buffer.append('first')
    buffer.append('second')
    expect(output).toEqual([])

    vi.advanceTimersByTime(TERMINAL_OUTPUT_FLUSH_MS)
    expect(output).toEqual(['firstsecond'])
  })

  it('keeps the newest output and marks a truncated burst', () => {
    const output: string[] = []
    const buffer = new TerminalOutputBuffer((data) => output.push(data))

    buffer.append('x'.repeat(TERMINAL_OUTPUT_MAX_BYTES + 5))
    buffer.flush()

    expect(output).toHaveLength(1)
    expect(output[0]).toContain('[porcelain: output truncated]')
    expect(output[0]?.endsWith('x'.repeat(TERMINAL_OUTPUT_MAX_BYTES))).toBe(true)
  })
})
