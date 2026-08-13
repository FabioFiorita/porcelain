import { describe, expect, it } from 'vitest'
import { formatBytes } from './format-bytes'

describe('formatBytes', () => {
  it('formats bytes under 1 KB as B', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats bytes under 1 MB as whole KB', () => {
    expect(formatBytes(2048)).toBe('2 KB')
  })

  it('formats bytes at or above 1 MB as tenths of MB', () => {
    expect(formatBytes(1_572_864)).toBe('1.5 MB')
  })
})
