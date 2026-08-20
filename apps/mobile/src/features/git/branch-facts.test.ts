import type { BranchRef } from '@porcelain/contracts/git'
import { describe, expect, it } from 'vitest'

import { branchLabel, matchBranches, publishPrompt } from './branch-facts'

const BRANCHES: readonly BranchRef[] = [
  { name: 'main', remote: null },
  { name: 'work/mobile-native-shell', remote: null },
  { name: 'main', remote: 'origin' },
  { name: 'work/mobile-native-shell', remote: 'origin' },
]

describe('branchLabel', () => {
  it('names a local ref bare and a remote ref by its remote', () => {
    expect(branchLabel({ name: 'main', remote: null })).toBe('main')
    expect(branchLabel({ name: 'main', remote: 'origin' })).toBe('origin/main')
  })
})

describe('matchBranches', () => {
  it('splits local from remote when nothing is typed', () => {
    const matches = matchBranches(BRANCHES, '')

    expect(matches.local.map(branchLabel)).toEqual(['main', 'work/mobile-native-shell'])
    expect(matches.remote.map(branchLabel)).toEqual([
      'origin/main',
      'origin/work/mobile-native-shell',
    ])
  })

  it('matches a remote ref on its full name, not just the branch part', () => {
    expect(matchBranches(BRANCHES, 'origin/main').local).toEqual([])
    expect(matchBranches(BRANCHES, 'origin/main').remote.map(branchLabel)).toEqual(['origin/main'])
  })

  it('ignores case and surrounding space', () => {
    expect(matchBranches(BRANCHES, '  MOBILE  ').local.map(branchLabel)).toEqual([
      'work/mobile-native-shell',
    ])
  })

  it('matches nothing rather than everything when the query is unknown', () => {
    const matches = matchBranches(BRANCHES, 'release')

    expect(matches.local).toEqual([])
    expect(matches.remote).toEqual([])
  })
})

describe('publishPrompt', () => {
  it('has nothing to ask before the head is read', () => {
    expect(publishPrompt(undefined)).toBeNull()
  })

  it('has nothing to ask on a detached head', () => {
    expect(publishPrompt({ branch: null, detachedSha: 'abc1234', upstream: null })).toBeNull()
  })

  it('has nothing to ask when the branch already tracks its own remote', () => {
    expect(publishPrompt({ branch: 'main', detachedSha: null, upstream: 'origin/main' })).toBeNull()
  })

  it('warns that the first push creates the remote branch', () => {
    const prompt = publishPrompt({ branch: 'work/foo', detachedSha: null, upstream: null })

    expect(prompt?.title).toBe('Publish work/foo?')
    expect(prompt?.body).toBe(
      'This branch has no remote yet. Push will create origin/work/foo and set it as the upstream.',
    )
  })

  it('warns that the push repoints a mismatched upstream', () => {
    const prompt = publishPrompt({ branch: 'work/foo', detachedSha: null, upstream: 'origin/main' })

    expect(prompt?.body).toBe(
      'This branch tracks origin/main, not a remote of the same name. Push will create origin/work/foo and switch tracking to it.',
    )
  })
})
