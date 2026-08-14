import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { HubRepoProvider, useHubRepoPath } from './hub-repo'
import { useProjectSelectionStore } from './project-selection'

describe('useHubRepoPath', () => {
  beforeEach(() => {
    useProjectSelectionStore.setState({ project: { path: '/selected', name: 'selected' } })
  })

  it('follows the selected Worktree when no Viewer pane overrides it', () => {
    const { result } = renderHook(() => useHubRepoPath())
    expect(result.current).toBe('/selected')
  })

  it('uses the tab Worktree even when a different Worktree is selected', () => {
    const { result } = renderHook(() => useHubRepoPath(), {
      wrapper: ({ children }) => (
        <HubRepoProvider repoPath="/tab-worktree">{children}</HubRepoProvider>
      ),
    })
    expect(result.current).toBe('/tab-worktree')
    expect(useProjectSelectionStore.getState().project?.path).toBe('/selected')
  })

  it('keeps a tab readable when Home has cleared the selected Worktree', () => {
    useProjectSelectionStore.setState({ project: null })
    const { result } = renderHook(() => useHubRepoPath(), {
      wrapper: ({ children }) => (
        <HubRepoProvider repoPath="/tab-worktree">{children}</HubRepoProvider>
      ),
    })
    expect(result.current).toBe('/tab-worktree')
  })
})
