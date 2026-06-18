import { beforeEach, describe, expect, it } from 'vitest'
import { useSearchStore } from './search'

describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.setState({ recent: [] })
  })

  it('remembers queries most-recent-first, deduped', () => {
    const { remember } = useSearchStore.getState()
    remember('foo')
    remember('bar')
    remember('foo')
    expect(useSearchStore.getState().recent).toEqual(['foo', 'bar'])
  })

  it('ignores blank queries', () => {
    useSearchStore.getState().remember('   ')
    expect(useSearchStore.getState().recent).toEqual([])
  })

  it('caps the recent list at 8', () => {
    const { remember } = useSearchStore.getState()
    for (let i = 0; i < 12; i++) remember(`q${i}`)
    const { recent } = useSearchStore.getState()
    expect(recent).toHaveLength(8)
    expect(recent[0]).toBe('q11')
  })

  it('forgets a specific query', () => {
    useSearchStore.setState({ recent: ['a', 'b', 'c'] })
    useSearchStore.getState().forget('b')
    expect(useSearchStore.getState().recent).toEqual(['a', 'c'])
  })
})
