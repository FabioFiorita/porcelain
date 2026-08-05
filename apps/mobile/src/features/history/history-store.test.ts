import { beforeEach, describe, expect, it } from 'vitest'

import { selectedHash, useHistoryStore } from './history-store'

const store = (): ReturnType<typeof useHistoryStore.getState> => useHistoryStore.getState()

beforeEach(() => {
  store().clear()
})

describe('useHistoryStore', () => {
  it('opens a commit', () => {
    store().openCommit('abc')
    expect(store().selection).toEqual({ hash: 'abc', kind: 'commit' })
  })

  it('opens a file inside a commit, keeping the commit it belongs to', () => {
    store().openFile('abc', 'src/a.ts')
    expect(store().selection).toEqual({ hash: 'abc', kind: 'file', path: 'src/a.ts' })
  })

  it('steps a file back to its commit rather than to the list', () => {
    store().openFile('abc', 'src/a.ts')
    store().closeFile()
    expect(store().selection).toEqual({ hash: 'abc', kind: 'commit' })
  })

  it('steps the continuous read back to its commit too', () => {
    store().openAll('abc')
    store().closeFile()
    expect(store().selection).toEqual({ hash: 'abc', kind: 'commit' })
  })

  // The commit is the top of the viewer's stack — the list is beside it, not behind it.
  it('leaves a commit alone when there is nothing to step back to', () => {
    store().openCommit('abc')
    store().closeFile()
    expect(store().selection).toEqual({ hash: 'abc', kind: 'commit' })
  })

  it('leaves the resting state alone', () => {
    store().closeFile()
    expect(store().selection).toBeNull()
  })
})

describe('selectedHash', () => {
  it('names the commit at every level of the stack', () => {
    expect(selectedHash({ hash: 'abc', kind: 'commit' })).toBe('abc')
    expect(selectedHash({ hash: 'abc', kind: 'file', path: 'a.ts' })).toBe('abc')
    expect(selectedHash({ hash: 'abc', kind: 'all' })).toBe('abc')
    expect(selectedHash(null)).toBeNull()
  })
})

describe('timelinePath', () => {
  it('remembers the file after stepping back to its commit', () => {
    store().openFile('abc', 'src/a.ts')
    store().openCommit('abc')
    // The phone's companion opens from the list, long after the diff screen is gone — a
    // timeline that only lived while the file was on screen could never be read there.
    expect(store().timelinePath).toBe('src/a.ts')
  })

  it('drops the file when another commit is opened', () => {
    store().openFile('abc', 'src/a.ts')
    store().openCommit('def')
    expect(store().timelinePath).toBeNull()
  })

  it('keeps it across the continuous read of the same commit', () => {
    store().openFile('abc', 'src/a.ts')
    store().openAll('abc')
    expect(store().timelinePath).toBe('src/a.ts')
  })

  it('starts empty and clears with the selection', () => {
    expect(store().timelinePath).toBeNull()
    store().openFile('abc', 'src/a.ts')
    store().clear()
    expect(store().timelinePath).toBeNull()
  })
})
