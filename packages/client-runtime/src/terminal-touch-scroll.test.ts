import { describe, expect, it, vi } from 'vitest'
import {
  applyTerminalTouchScroll,
  applyTouchScrollDelta,
  encodeSgrWheel,
  mouseModeHasWheel,
  type TerminalTouchScrollTarget,
} from './terminal-touch-scroll'

function mockTarget(
  partial: Partial<TerminalTouchScrollTarget> &
    Pick<TerminalTouchScrollTarget, 'bufferType' | 'mouseTrackingMode'>,
): {
  target: TerminalTouchScrollTarget
  scrollLines: ReturnType<typeof vi.fn<(lines: number) => void>>
  input: ReturnType<typeof vi.fn<(data: string) => void>>
} {
  const scrollLines = vi.fn<(lines: number) => void>()
  const input = vi.fn<(data: string) => void>()
  return {
    target: {
      cols: 80,
      rows: 24,
      scrollLines,
      input,
      ...partial,
    },
    scrollLines,
    input,
  }
}

describe('encodeSgrWheel', () => {
  it('encodes wheel up/down as SGR 64/65, never arrow CSI', () => {
    expect(encodeSgrWheel(-1, 10, 5)).toBe('\x1b[<64;10;5M')
    expect(encodeSgrWheel(2, 10, 5)).toBe('\x1b[<65;10;5M\x1b[<65;10;5M')
    expect(encodeSgrWheel(-1, 10, 5)).not.toMatch(/[AB]$/)
  })

  it('returns empty for zero lines', () => {
    expect(encodeSgrWheel(0, 1, 1)).toBe('')
  })
})

describe('mouseModeHasWheel', () => {
  it('is true only for protocols that include wheel', () => {
    expect(mouseModeHasWheel('none')).toBe(false)
    expect(mouseModeHasWheel('x10')).toBe(false)
    expect(mouseModeHasWheel('vt200')).toBe(true)
    expect(mouseModeHasWheel('drag')).toBe(true)
    expect(mouseModeHasWheel('any')).toBe(true)
  })
})

describe('applyTerminalTouchScroll', () => {
  it('normal buffer only uses scrollLines — never keys', () => {
    const { target, scrollLines, input } = mockTarget({
      bufferType: 'normal',
      mouseTrackingMode: 'none',
    })
    applyTerminalTouchScroll(target, -3)
    expect(scrollLines).toHaveBeenCalledWith(-3)
    expect(input).not.toHaveBeenCalled()
  })

  it('alternate + wheel mouse writes SGR wheel reports, never arrows', () => {
    const { target, scrollLines, input } = mockTarget({
      bufferType: 'alternate',
      mouseTrackingMode: 'any',
      cols: 80,
      rows: 24,
    })
    applyTerminalTouchScroll(target, -2)
    expect(scrollLines).not.toHaveBeenCalled()
    expect(input).toHaveBeenCalledTimes(1)
    const seq = String(input.mock.calls[0]?.[0] ?? '')
    expect(seq).toContain('\x1b[<64;')
    // Must not be CSI A/B or SS3 A/B (arrow-key "wheel" emulation)
    expect(
      seq.includes('\x1b[A') ||
        seq.includes('\x1b[B') ||
        seq.includes('\x1bOA') ||
        seq.includes('\x1bOB'),
    ).toBe(false)
  })

  it('alternate without wheel mouse uses PageUp/PageDown, never arrows', () => {
    const { target, scrollLines, input } = mockTarget({
      bufferType: 'alternate',
      mouseTrackingMode: 'none',
      rows: 24,
    })
    applyTerminalTouchScroll(target, -6)
    expect(scrollLines).not.toHaveBeenCalled()
    expect(input).toHaveBeenCalled()
    for (const [seq] of input.mock.calls) {
      expect(seq).toBe('\x1b[5~')
      expect(seq).not.toMatch(/[AB]$/)
    }
  })

  it('x10 (no wheel) falls back to PageUp, not SGR wheel', () => {
    const { target, input } = mockTarget({
      bufferType: 'alternate',
      mouseTrackingMode: 'x10',
    })
    applyTerminalTouchScroll(target, -3)
    for (const [seq] of input.mock.calls) {
      expect(seq).toBe('\x1b[5~')
    }
  })

  it('alternate without mouse PageDown for newer content', () => {
    const { target, input } = mockTarget({ bufferType: 'alternate', mouseTrackingMode: 'none' })
    applyTerminalTouchScroll(target, 4)
    for (const [seq] of input.mock.calls) {
      expect(seq).toBe('\x1b[6~')
    }
  })
})

describe('applyTouchScrollDelta', () => {
  it('accumulates sub-cell moves without scrolling', () => {
    const a = applyTouchScrollDelta(0, 5, 12)
    expect(a).toEqual({ residual: -5, lines: 0 })
    const b = applyTouchScrollDelta(a.residual, 5, 12)
    expect(b).toEqual({ residual: -10, lines: 0 })
  })

  it('finger-down yields negative lines (older scrollback)', () => {
    expect(applyTouchScrollDelta(0, 24, 12)).toEqual({ residual: 0, lines: -2 })
  })

  it('finger-up yields positive lines (newer content)', () => {
    expect(applyTouchScrollDelta(0, -36, 12)).toEqual({ residual: 0, lines: 3 })
  })

  it('keeps residual after emitting whole lines', () => {
    expect(applyTouchScrollDelta(0, 30, 12)).toEqual({ residual: -6, lines: -2 })
  })

  it('carries residual across calls', () => {
    const a = applyTouchScrollDelta(0, 8, 12)
    const b = applyTouchScrollDelta(a.residual, 8, 12)
    expect(b).toEqual({ residual: -4, lines: -1 })
  })

  it('returns zero lines when cellHeight is non-positive', () => {
    expect(applyTouchScrollDelta(0, 24, 0)).toEqual({ residual: -24, lines: 0 })
    expect(applyTouchScrollDelta(0, 24, -1)).toEqual({ residual: -24, lines: 0 })
  })
})
