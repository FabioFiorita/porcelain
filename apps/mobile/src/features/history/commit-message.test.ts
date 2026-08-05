import { describe, expect, it } from 'vitest'

import { commitTitle, shortHash, splitCommitMessage } from './commit-message'

describe('splitCommitMessage', () => {
  it('takes the first line as the subject', () => {
    expect(splitCommitMessage('feat(mobile): give History a viewer')).toEqual({
      body: '',
      subject: 'feat(mobile): give History a viewer',
    })
  })

  it('drops the blank line that convention puts between subject and body', () => {
    const message = 'fix: stop the flash\n\nThe range query was disabled while its base loaded.'
    expect(splitCommitMessage(message)).toEqual({
      body: 'The range query was disabled while its base loaded.',
      subject: 'fix: stop the flash',
    })
  })

  it('keeps the body’s own paragraph breaks', () => {
    const { body } = splitCommitMessage('subject\n\nfirst\n\nsecond\n')
    expect(body).toBe('first\n\nsecond')
  })

  it('handles a body that starts on the very next line', () => {
    expect(splitCommitMessage('subject\nbody').body).toBe('body')
  })

  it('survives an empty message', () => {
    expect(splitCommitMessage('')).toEqual({ body: '', subject: '' })
  })
})

describe('shortHash', () => {
  it('abbreviates to the seven characters every git surface prints', () => {
    expect(shortHash('8d033b1f2c4e5a6b7c8d9e0f1a2b3c4d5e6f7a8b')).toBe('8d033b1')
  })
})

describe('commitTitle', () => {
  it('titles a commit by its subject', () => {
    expect(commitTitle('feat: x\n\nbody', 'abc1234def')).toBe('feat: x')
  })

  it('falls back to the short hash while the message is still loading', () => {
    expect(commitTitle(undefined, 'abc1234def')).toBe('abc1234')
  })

  it('falls back to the short hash for a commit with no message at all', () => {
    expect(commitTitle('   \n', 'abc1234def')).toBe('abc1234')
  })
})
