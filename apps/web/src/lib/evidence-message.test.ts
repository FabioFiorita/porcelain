import { describe, expect, it } from 'vitest'
import { evidenceOverCapMessage, formatEvidenceMb } from './evidence-message'

describe('formatEvidenceMb', () => {
  it('formats bytes as MB with one decimal', () => {
    expect(formatEvidenceMb(4_194_304)).toBe('4.0 MB')
    expect(formatEvidenceMb(3_700_000)).toBe('3.5 MB')
  })
})

describe('evidenceOverCapMessage', () => {
  it('names both sizes and never says "cleared"', () => {
    const msg = evidenceOverCapMessage({ bytes: 5_000_000, maxBytes: 4_194_304 })
    expect(msg).toContain('4.8 MB')
    expect(msg).toContain('4.0 MB')
    expect(msg).not.toContain('cleared')
  })
})
