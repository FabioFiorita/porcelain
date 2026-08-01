import { beforeEach, describe, expect, it } from 'vitest'
import { useCommitDraftStore } from './commit-draft'

describe('useCommitDraftStore', () => {
  beforeEach(() => useCommitDraftStore.setState({ messages: {} }))

  it('starts with no drafts', () => {
    expect(useCommitDraftStore.getState().messages).toEqual({})
  })

  it('setMessage stores a draft per repo path', () => {
    useCommitDraftStore.getState().setMessage('/repo/a', 'feat: thing')
    useCommitDraftStore.getState().setMessage('/repo/b', 'fix: bug')
    expect(useCommitDraftStore.getState().messages).toEqual({
      '/repo/a': 'feat: thing',
      '/repo/b': 'fix: bug',
    })
  })

  it('setMessage overwrites the same repo without touching others', () => {
    useCommitDraftStore.getState().setMessage('/repo/a', 'draft one')
    useCommitDraftStore.getState().setMessage('/repo/b', 'other repo')
    useCommitDraftStore.getState().setMessage('/repo/a', 'draft two')
    expect(useCommitDraftStore.getState().messages).toEqual({
      '/repo/a': 'draft two',
      '/repo/b': 'other repo',
    })
  })

  it('clearMessage drops only that repo’s draft', () => {
    useCommitDraftStore.getState().setMessage('/repo/a', 'feat: thing')
    useCommitDraftStore.getState().setMessage('/repo/b', 'fix: bug')
    useCommitDraftStore.getState().clearMessage('/repo/a')
    expect(useCommitDraftStore.getState().messages).toEqual({ '/repo/b': 'fix: bug' })
  })

  it('clearMessage on an unknown repo is a no-op', () => {
    useCommitDraftStore.getState().setMessage('/repo/a', 'feat: thing')
    const before = useCommitDraftStore.getState().messages
    useCommitDraftStore.getState().clearMessage('/repo/missing')
    expect(useCommitDraftStore.getState().messages).toBe(before)
  })
})
