import { beforeEach, describe, expect, it } from 'vitest'
import { hydrateCommitDrafts, useCommitDraftStore } from './commit-draft'

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

describe('hydrateCommitDrafts', () => {
  it('keeps a valid draft map', () => {
    expect(hydrateCommitDrafts({ messages: { '/repo/a': 'feat: thing' } })).toEqual({
      messages: { '/repo/a': 'feat: thing' },
    })
    expect(hydrateCommitDrafts({ messages: {} })).toEqual({ messages: {} })
  })

  it('falls back for a corrupt, stale, or partly invalid map', () => {
    for (const corrupt of [null, undefined, 'drafts', 7, [], { messages: null }]) {
      expect(hydrateCommitDrafts(corrupt), JSON.stringify(corrupt ?? null)).toEqual({})
    }
    // Stale shape: drafts used to be a bare string, and one non-string entry poisons the
    // whole map — a lost draft is recoverable, a composer holding an object is not.
    expect(hydrateCommitDrafts({ messages: 'feat: thing' })).toEqual({})
    expect(hydrateCommitDrafts({ messages: { '/repo/a': 'ok', '/repo/b': 3 } })).toEqual({})
  })

  it('ignores keys from another build and a missing map', () => {
    expect(hydrateCommitDrafts({ messages: { '/repo/a': 'ok' }, groups: [1, 2] })).toEqual({
      messages: { '/repo/a': 'ok' },
    })
    expect(hydrateCommitDrafts({ groups: [] })).toEqual({})
  })
})
