import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { HubRepoProvider, useHubRepoPath, useHubRepoTarget } from './hub-repo'
import { useHubSelectionStore } from './hub-selection'
import { useProjectSelectionStore } from './project-selection'

describe('useHubRepoPath', () => {
  beforeEach(() => {
    useProjectSelectionStore.setState({ project: { path: '/selected', name: 'selected' } })
    useHubSelectionStore.setState({
      selection: {
        kind: 'worktree',
        environmentId: 'env-primary',
        projectId: 'project-selected',
        worktreeId: 'worktree-selected',
        path: '/selected',
      },
    })
  })

  it('follows the selected Worktree when no Viewer pane overrides it', () => {
    const { result } = renderHook(() => useHubRepoPath())
    expect(result.current).toBe('/selected')
  })

  it('uses the tab Worktree even when a different Worktree is selected', () => {
    const { result } = renderHook(() => useHubRepoPath(), {
      wrapper: ({ children }) => (
        <HubRepoProvider
          target={{
            environmentId: 'env-tab',
            projectId: 'project-tab',
            worktreeId: 'worktree-tab',
            path: '/tab-worktree',
          }}
        >
          {children}
        </HubRepoProvider>
      ),
    })
    expect(result.current).toBe('/tab-worktree')
  })

  it('keeps a tab readable when Home has cleared the selected Worktree', () => {
    useHubSelectionStore.setState({ selection: { kind: 'home' } })
    const { result } = renderHook(() => useHubRepoPath(), {
      wrapper: ({ children }) => <HubRepoProvider target={null}>{children}</HubRepoProvider>,
    })
    expect(result.current).toBeNull()
  })

  it('carries the complete target identity instead of only a path', () => {
    const target = {
      environmentId: 'env-tab',
      projectId: 'project-tab',
      worktreeId: 'worktree-tab',
      path: '/tab-worktree',
    }
    const { result } = renderHook(() => useHubRepoTarget(), {
      wrapper: ({ children }) => <HubRepoProvider target={target}>{children}</HubRepoProvider>,
    })
    expect(result.current).toEqual(target)
  })
})
