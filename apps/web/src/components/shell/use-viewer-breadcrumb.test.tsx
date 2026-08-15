import { hubInventorySchema, projectsContractFixtures } from '@porcelain/contracts/projects'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useTabsStore } from '@renderer/stores/tabs'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const local = hubInventorySchema.parse(projectsContractFixtures.hubInventory.output)

// Same Project and Worktree ids on a second Environment: the collision the Environment id has to
// break. Only the names differ, so a breadcrumb that ignored `environmentId` still renders — with
// the wrong labels — instead of failing loudly.
const remote = hubInventorySchema.parse({
  ...local,
  environment: { ...local.environment, id: 'env-remote', name: 'remote' },
  projects: local.projects.map((project) => ({
    ...project,
    environmentId: 'env-remote',
    name: `${project.name}-remote`,
    worktrees: project.worktrees.map((worktree) => ({
      ...worktree,
      branch: `${worktree.branch}-remote`,
    })),
  })),
})

const inventories = [
  { environmentId: null, current: true, inventory: local },
  { environmentId: 'env-remote', current: false, inventory: remote },
]

vi.mock('@renderer/features/projects', () => ({
  useHubInventories: () => inventories,
}))

const { useViewerBreadcrumb } = await import('./use-viewer-breadcrumb')

const worktree = local.projects[0]?.worktrees[0]
const project = local.projects[0]

if (project === undefined || worktree === undefined) {
  throw new Error('Hub inventory fixture must include a Project with a Worktree')
}

const selectWorktreeOn = (environmentId: string): void => {
  useHubSelectionStore.getState().selectWorktree({
    environmentId,
    projectId: project.id,
    worktreeId: worktree.id,
    path: worktree.path,
    name: worktree.name,
  })
}

beforeEach(() => {
  useHubSelectionStore.getState().selectHome()
  useTabsStore.setState(useTabsStore.getInitialState(), true)
})

describe('useViewerBreadcrumb', () => {
  it('labels the selected Worktree from the Environment that owns it', () => {
    selectWorktreeOn(local.environment.id)
    expect(renderHook(() => useViewerBreadcrumb()).result.current).toEqual([
      { id: 'project', label: project.name },
      { id: 'worktree', label: worktree.branch },
    ])
  })

  it('resolves a colliding Project id against the remote Environment, not the local one', () => {
    selectWorktreeOn('env-remote')
    expect(renderHook(() => useViewerBreadcrumb()).result.current).toEqual([
      { id: 'project', label: `${project.name}-remote` },
      { id: 'worktree', label: `${worktree.branch}-remote` },
    ])
  })

  it('falls back to the selected Project name when no Environment matches', () => {
    selectWorktreeOn('env-vanished')
    expect(renderHook(() => useViewerBreadcrumb()).result.current).toEqual([
      { id: 'selected-project', label: worktree.name },
    ])
  })
})
