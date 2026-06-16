import { describe, expect, it } from 'vitest'
import { isNoMatchError, quickCommandArgs } from './git'

describe('isNoMatchError', () => {
  it('treats exit code 1 as no-match', () => {
    expect(isNoMatchError({ code: 1 })).toBe(true)
  })
  it('treats other exit codes and errors as real failures', () => {
    expect(isNoMatchError({ code: 2 })).toBe(false)
    expect(isNoMatchError({ code: 'ENOENT' })).toBe(false)
    expect(isNoMatchError(new Error('boom'))).toBe(false)
    expect(isNoMatchError(null)).toBe(false)
  })
})

describe('quickCommandArgs', () => {
  it('resolves static commands to their fixed args', () => {
    expect(quickCommandArgs('status')).toEqual(['status'])
    expect(quickCommandArgs('push')).toEqual(['push'])
    expect(quickCommandArgs('fetch')).toEqual(['fetch'])
    expect(quickCommandArgs('stash-pop')).toEqual(['stash', 'pop'])
  })

  it('appends the pull strategy flag so the choice beats the gitconfig default', () => {
    expect(quickCommandArgs('pull', 'merge')).toEqual(['pull', '--no-rebase'])
    expect(quickCommandArgs('pull', 'rebase')).toEqual(['pull', '--rebase'])
  })

  it('defaults pull to merge', () => {
    expect(quickCommandArgs('pull')).toEqual(['pull', '--no-rebase'])
  })

  it('ignores pullMode for non-pull commands', () => {
    expect(quickCommandArgs('fetch', 'rebase')).toEqual(['fetch'])
  })

  it('returns null for an unknown id', () => {
    expect(quickCommandArgs('rm-rf')).toBeNull()
  })
})
