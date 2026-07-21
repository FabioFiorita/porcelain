import { describe, expect, it } from 'vitest'
import { estimateContextPercent, parseContextWindowTokens } from './agent-context-window'

describe('parseContextWindowTokens', () => {
  it('parses k and m suffixes', () => {
    expect(parseContextWindowTokens('200k')).toBe(200_000)
    expect(parseContextWindowTokens('1m')).toBe(1_000_000)
    expect(parseContextWindowTokens('128000')).toBe(128_000)
  })
  it('returns null for junk', () => {
    expect(parseContextWindowTokens(undefined)).toBeNull()
    expect(parseContextWindowTokens('')).toBeNull()
    expect(parseContextWindowTokens('big')).toBeNull()
  })
})

describe('estimateContextPercent', () => {
  it('rounds share of the window', () => {
    expect(estimateContextPercent(42_000, '200k')).toBe(21)
    expect(estimateContextPercent(200_000, '200k')).toBe(100)
    expect(estimateContextPercent(300_000, '200k')).toBe(100)
  })
  it('returns null without a window', () => {
    expect(estimateContextPercent(1000, undefined)).toBeNull()
  })
})
