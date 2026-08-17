import { describe, expect, it } from 'vitest'
import {
  extractHashTags,
  extractLinks,
  liftCompletedTokens,
  mentionAtCursor,
  replaceMention,
} from './task-mentions'

describe('mentionAtCursor', () => {
  it('finds an @file token the caret is inside', () => {
    expect(mentionAtCursor('see @src/ap', 11)).toEqual({
      kind: 'file',
      query: 'src/ap',
      start: 4,
      end: 11,
    })
  })

  it('finds a #tag token the caret is inside', () => {
    expect(mentionAtCursor('fix #inf', 8)).toEqual({
      kind: 'tag',
      query: 'inf',
      start: 4,
      end: 8,
    })
  })

  it('is silent when the caret is not in a mention', () => {
    expect(mentionAtCursor('just words', 5)).toBeNull()
  })
})

describe('extractHashTags', () => {
  it('collects unique hash tags from the body', () => {
    expect(extractHashTags('Ship #infra and #ui', 'also #infra')).toEqual(['infra', 'ui'])
  })
})

describe('extractLinks', () => {
  it('pulls http(s) URLs and labels them with the host', () => {
    expect(extractLinks('see https://herdr.dev/docs and http://example.com')).toEqual([
      { url: 'https://herdr.dev/docs', label: 'herdr.dev' },
      { url: 'http://example.com', label: 'example.com' },
    ])
  })
})

describe('liftCompletedTokens', () => {
  it('moves finished tags, files, and links out of the body', () => {
    const lifted = liftCompletedTokens(
      'Pasted from the session https://herdr.dev/ @README.md #setup',
      22,
    )
    expect(lifted.notes).toContain('Pasted from the session')
    expect(lifted.notes).not.toContain('https://herdr.dev/')
    expect(lifted.notes).not.toContain('@README.md')
    expect(lifted.notes).not.toContain('#setup')
    expect(lifted.tags).toEqual(['setup'])
    expect(lifted.paths).toEqual(['README.md'])
    expect(lifted.links).toEqual([{ url: 'https://herdr.dev/', label: 'herdr.dev' }])
  })

  it('leaves the token the caret is still typing', () => {
    const lifted = liftCompletedTokens('notes #set', 10)
    expect(lifted.notes).toContain('#set')
    expect(lifted.tags).toEqual([])
  })
})

describe('replaceMention', () => {
  it('swaps the token under the caret for the chosen path', () => {
    const mention = mentionAtCursor('see @src', 8)
    expect(mention).not.toBeNull()
    if (mention === null) return
    expect(replaceMention('see @src', mention, '@src/app.ts')).toEqual({
      text: 'see @src/app.ts',
      cursor: 15,
    })
  })
})
