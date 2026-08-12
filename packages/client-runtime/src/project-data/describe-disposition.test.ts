import { describe, expect, it } from 'vitest'
import { describeDisposition } from './describe-disposition'

describe('describeDisposition', () => {
  it('says a local channel keeps its file, so Local never reads as deletion', () => {
    expect(describeDisposition('local', 0)).toBe('Ignored — stays in this clone.')
  })

  // The count belongs to git, not to some second local store. The old
  // `Local (1)` label invited the opposite reading.
  it('reads the tracked count as what Local would untrack', () => {
    expect(describeDisposition('shared', 1)).toBe(
      'In git · 1 file tracked — Local stages its removal.',
    )
    expect(describeDisposition('shared', 4)).toBe(
      'In git · 4 files tracked — Local stages their removal.',
    )
  })

  // Shared only removes the ignore line; staging stays the human's act, so a
  // freshly-shared channel is still invisible to teammates until they commit.
  it('does not claim a shared channel reached anyone before it was staged', () => {
    expect(describeDisposition('shared', 0)).toBe(
      'Shared — nothing committed yet; stage it to reach teammates.',
    )
  })

  it('never counts files for a local channel', () => {
    expect(describeDisposition('local', 3)).not.toContain('3')
  })
})
