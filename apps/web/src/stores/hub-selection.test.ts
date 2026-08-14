import { beforeEach, describe, expect, it } from 'vitest'
import { useHubSelectionStore } from './hub-selection'
import { useProjectSelectionStore } from './project-selection'
import { tabId, useTabsStore } from './tabs'

const main = {
  environmentId: 'env-1',
  projectId: 'proj-1',
  worktreeId: 'wt-main',
  path: '/repos/alpha',
  name: 'alpha',
}

describe('Hub selection', () => {
  beforeEach(() => {
    useHubSelectionStore.setState({ selection: { kind: 'home' } })
    useProjectSelectionStore.setState({ project: null })
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
  })

  it('selects Home, Project, and Worktree without closing existing tabs', () => {
    useTabsStore.getState().openTab({
      id: tabId('file', '/repos/alpha/README.md', {
        environmentId: main.environmentId,
        projectId: main.projectId,
        worktreeId: main.worktreeId,
        path: main.path,
      }),
      kind: 'file',
      title: 'README.md',
      path: '/repos/alpha/README.md',
      target: {
        environmentId: main.environmentId,
        projectId: main.projectId,
        worktreeId: main.worktreeId,
        path: main.path,
      },
    })

    useHubSelectionStore.getState().selectWorktree(main)
    expect(useHubSelectionStore.getState().selection).toMatchObject({
      kind: 'worktree',
      worktreeId: 'wt-main',
    })
    expect(useProjectSelectionStore.getState().project).toEqual({
      path: '/repos/alpha',
      name: 'alpha',
    })

    useHubSelectionStore.getState().selectProject({
      environmentId: 'env-1',
      projectId: 'proj-1',
    })
    expect(useHubSelectionStore.getState().selection.kind).toBe('project')
    expect(useTabsStore.getState().panes[0]?.tabs).toHaveLength(1)
    expect(useTabsStore.getState().panes[0]?.tabs[0]?.target?.worktreeId).toBe('wt-main')

    useHubSelectionStore.getState().selectHome()
    expect(useHubSelectionStore.getState().selection).toEqual({ kind: 'home' })
    expect(useTabsStore.getState().panes[0]?.tabs).toHaveLength(1)
  })
})
