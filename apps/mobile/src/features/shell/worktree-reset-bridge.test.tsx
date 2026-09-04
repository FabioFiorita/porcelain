import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  environmentId: 'environment-one' as string | null,
  repoPath: '/synthetic/one' as string | null,
}))

vi.mock('@/features/projects', () => ({
  useHubRepoPath: () => ctx.repoPath,
}))

vi.mock('@/features/remote', () => ({
  useActiveEnvironment: () => (ctx.environmentId === null ? null : { id: ctx.environmentId }),
}))

import { useChangesStore } from '@/features/changes/changes-store'
import { useFilesStore } from '@/features/files/files-store'
import { useHistoryStore } from '@/features/history/history-store'
import { useSearchStore } from '@/features/search/search-store'

import { WorktreeResetBridge } from './worktree-reset-bridge'

/**
 * The bug this bridge exists for, as a test.
 *
 * Three stores hold a position inside a repository and none of them carries the repository it
 * belongs to. That cost nothing while those cursors only drove a viewer column nobody could see;
 * the tablet's Surfaces panel put them on screen, so switching Worktrees opened the next one at
 * a path from the last one — with its commit still marked in the list beside it.
 *
 * The second case is the one that would be easy to regress into: clearing on MOUNT as well as on
 * change would wipe the cursor every time the tree re-mounted, which on this client happens on
 * every Fast Refresh and every theme flip.
 */
describe('WorktreeResetBridge', () => {
  beforeEach(() => {
    ctx.repoPath = '/synthetic/one'
    ctx.environmentId = 'environment-one'
    useFilesStore.getState().openDir('apps/mobile/src')
    useFilesStore.getState().openFile('apps/mobile/src/index.ts')
    useChangesStore.getState().openFile('src/changed.ts')
    useHistoryStore.getState().openCommit('abc1234')
    useSearchStore.getState().setQuery('needle')
  })

  it('leaves every cursor alone while the Worktree is the same', () => {
    const view = render(<WorktreeResetBridge />)
    view.rerender(<WorktreeResetBridge />)

    expect(useFilesStore.getState().cursor).toBe('apps/mobile/src')
    expect(useChangesStore.getState().selection).not.toBeNull()
    expect(useHistoryStore.getState().selection).not.toBeNull()
    expect(useSearchStore.getState().query).toBe('needle')
  })

  it('drops every per-checkout cursor when the Worktree changes', () => {
    const view = render(<WorktreeResetBridge />)
    ctx.repoPath = '/synthetic/two'
    view.rerender(<WorktreeResetBridge />)

    expect(useFilesStore.getState().cursor).toBe('')
    expect(useFilesStore.getState().selection).toBeNull()
    expect(useChangesStore.getState().selection).toBeNull()
    expect(useHistoryStore.getState().selection).toBeNull()
    expect(useHistoryStore.getState().timelinePath).toBeNull()
    expect(useSearchStore.getState().query).toBe('')
  })

  it('drops every per-checkout cursor when the Environment changes at the same path', () => {
    const view = render(<WorktreeResetBridge />)
    ctx.environmentId = 'environment-two'
    view.rerender(<WorktreeResetBridge />)

    expect(useFilesStore.getState().cursor).toBe('')
    expect(useFilesStore.getState().selection).toBeNull()
    expect(useChangesStore.getState().selection).toBeNull()
    expect(useHistoryStore.getState().selection).toBeNull()
    expect(useSearchStore.getState().query).toBe('')
  })

  it('keeps the reader’s own settings, which are not places', () => {
    useFilesStore.setState({ showHidden: true })
    useChangesStore.getState().setScope('branch')
    useSearchStore.getState().rememberSearch('needle')

    const view = render(<WorktreeResetBridge />)
    ctx.repoPath = '/synthetic/two'
    view.rerender(<WorktreeResetBridge />)

    expect(useFilesStore.getState().showHidden).toBe(true)
    expect(useChangesStore.getState().scope).toBe('branch')
    expect(useSearchStore.getState().recentSearches).toContain('needle')
  })

  it('handles losing the Worktree entirely', () => {
    const view = render(<WorktreeResetBridge />)
    ctx.repoPath = null
    view.rerender(<WorktreeResetBridge />)

    expect(useFilesStore.getState().cursor).toBe('')
    expect(useHistoryStore.getState().selection).toBeNull()
  })
})
