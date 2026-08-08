import { describe, expect, it } from 'vitest'

import type { FlowGroup } from '@/lib/daemon/procedures/changes'

import { commitReady, stagingState } from './commit-staging'

function tree(...files: { path: string; staged?: boolean; unstaged?: boolean }[]): FlowGroup[] {
  return [
    {
      files: files.map((file) => ({ connects: [], status: 'modified' as const, ...file })),
      layer: 'Other',
    },
  ]
}

describe('stagingState', () => {
  it('is a clean tree before anything has been read', () => {
    expect(stagingState(undefined)).toEqual({
      allStaged: false,
      hasStaged: false,
      hasUnstaged: false,
      treeClean: true,
    })
    expect(stagingState([]).treeClean).toBe(true)
  })

  it('counts staged and unstaged files across every layer', () => {
    const groups: FlowGroup[] = [
      ...tree({ path: 'a.ts', staged: true }),
      ...tree({ path: 'b.ts', unstaged: true }),
    ]
    const state = stagingState(groups)
    expect(state).toEqual({
      allStaged: false,
      hasStaged: true,
      hasUnstaged: true,
      treeClean: false,
    })
  })

  it('is all-staged only when nothing is left outside the index', () => {
    expect(stagingState(tree({ path: 'a.ts', staged: true })).allStaged).toBe(true)
    expect(
      stagingState(tree({ path: 'a.ts', staged: true }, { path: 'b.ts', unstaged: true }))
        .allStaged,
    ).toBe(false)
  })

  it('is not all-staged for a file that is staged and edited again', () => {
    // The toggle would offer "Unstage all" while half of that file's change is still not
    // staged — the opposite of what the reader is looking at.
    const state = stagingState(tree({ path: 'a.ts', staged: true, unstaged: true }))
    expect(state.allStaged).toBe(false)
    expect(state.hasStaged).toBe(true)
    expect(state.hasUnstaged).toBe(true)
  })
})

describe('commitReady', () => {
  it('needs a message and a tree with something in it', () => {
    expect(commitReady('fix: land the thing', false)).toBe(true)
    expect(commitReady('fix: land the thing', true)).toBe(false)
    expect(commitReady('', false)).toBe(false)
    expect(commitReady('   ', false)).toBe(false)
  })

  it('does not count a bare conventional prefix as a message', () => {
    // Picking a type and a scope from the chips is not writing a commit message.
    expect(commitReady('feat(mobile): ', false)).toBe(false)
    expect(commitReady('feat: ', false)).toBe(false)
    expect(commitReady('feat(mobile): split the card', false)).toBe(true)
  })
})
