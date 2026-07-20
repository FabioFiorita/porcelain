import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { prepareGrokImagePrompt } from './grok'

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('prepareGrokImagePrompt', () => {
  it('inlines small images as ACP image blocks', () => {
    const { promptJson, cleanup } = prepareGrokImagePrompt('look', [
      { mediaType: 'image/png', base64: TINY_PNG_B64 },
    ])
    cleanup()
    const blocks = JSON.parse(promptJson) as unknown[]
    expect(blocks).toEqual([
      { type: 'text', text: 'look' },
      { type: 'image', mimeType: 'image/png', data: TINY_PNG_B64 },
    ])
  })

  it('writes large images to temp files and uses resource_link', () => {
    // Over the 1MB inline budget with a repeated chunk (not a valid PNG — the CLI
    // is not invoked here; we only assert the block shape + file write).
    const big = 'A'.repeat(1_000_001)
    const { promptJson, cleanup } = prepareGrokImagePrompt('big', [
      { mediaType: 'image/png', base64: big },
    ])
    try {
      const blocks = JSON.parse(promptJson) as Array<Record<string, string>>
      expect(blocks[0]).toEqual({ type: 'text', text: 'big' })
      expect(blocks[1]?.type).toBe('resource_link')
      expect(blocks[1]?.mimeType).toBe('image/png')
      expect(blocks[1]?.uri).toMatch(/^file:\/\//)
      const path = blocks[1]?.uri?.replace(/^file:\/\//, '') ?? ''
      expect(existsSync(path)).toBe(true)
      expect(readFileSync(path).length).toBeGreaterThan(0)
    } finally {
      cleanup()
    }
  })
})
