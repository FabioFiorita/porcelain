import type { HubInventory } from '@porcelain/contracts/projects'
import { hubInventorySchema, projectsContractFixtures } from '@porcelain/contracts/projects'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const local = hubInventorySchema.parse(projectsContractFixtures.hubInventory.output)
const remote = hubInventorySchema.parse({
  ...local,
  environment: { ...local.environment, id: 'env-remote', name: 'remote' },
  projects: local.projects.map((project) => ({
    ...project,
    id: `remote-${project.id}`,
    environmentId: 'env-remote',
    worktrees: project.worktrees.map((worktree) => ({
      ...worktree,
      id: `remote-${worktree.id}`,
      projectId: `remote-${project.id}`,
    })),
  })),
})

interface Source {
  environmentId: string | null
  current: boolean
  inventory: HubInventory
}

let inventories: readonly Source[] = []
const openProject = vi.fn(async () => undefined)
const openWindow = vi.fn()

vi.mock('./project-data', () => ({
  useHubInventories: () => inventories,
  useCreateHubWorktree: () => ({ create: vi.fn(), isPending: false }),
  useOpenProject: () => ({ open: openProject }),
  useRemoveHubProject: () => ({ remove: vi.fn(async () => undefined) }),
  useRemoveHubWorktree: () => ({ remove: vi.fn(async () => undefined) }),
  useSelectedProject: () => null,
}))

vi.mock('@renderer/hooks/use-new-window', () => ({
  useNewWindow: () => ({ openWindow }),
}))

const { HubTree } = await import('./hub-tree')

const localWorktree = local.projects[0]?.worktrees[0]

if (localWorktree === undefined) {
  throw new Error('Hub inventory fixture must include a Worktree')
}

beforeEach(() => {
  vi.clearAllMocks()
  useHubSelectionStore.getState().selectHome()
  inventories = [
    { environmentId: null, current: true, inventory: local },
    { environmentId: 'env-remote', current: false, inventory: remote },
  ]
})

describe('HubTree', () => {
  it('renders every live Environment as its own Project block', () => {
    render(<HubTree />)

    expect(screen.getByTestId(TestIds.hubProject('proj-alpha'))).toHaveTextContent('synthetic')
    expect(screen.getByTestId(TestIds.hubProject('remote-proj-alpha'))).toHaveTextContent('remote')
  })

  it('selects a Worktree in this window when it belongs to the bound Environment', async () => {
    render(<HubTree />)

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree(localWorktree.id)))

    expect(useHubSelectionStore.getState().selection).toEqual({
      kind: 'worktree',
      environmentId: local.environment.id,
      projectId: localWorktree.projectId,
      worktreeId: localWorktree.id,
      path: localWorktree.path,
    })
    await waitFor(() =>
      expect(openProject).toHaveBeenCalledWith(localWorktree.path, {
        environmentId: local.environment.id,
      }),
    )
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('opens a Worktree from another Environment in this browser page with its owner target', async () => {
    render(<HubTree />)

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree(`remote-${localWorktree.id}`)))

    await waitFor(() =>
      expect(openProject).toHaveBeenCalledWith(localWorktree.path, {
        environmentId: 'env-remote',
      }),
    )
    expect(useHubSelectionStore.getState().selection).toMatchObject({
      kind: 'worktree',
      environmentId: 'env-remote',
      projectId: `remote-${localWorktree.projectId}`,
      worktreeId: `remote-${localWorktree.id}`,
    })
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('renders nothing while no Environment is live', () => {
    inventories = []
    render(<HubTree />)

    expect(screen.queryByTestId(TestIds.hubInventory)).toBeNull()
  })

  it('invites the human to open a repository when every live Environment is empty', () => {
    inventories = [
      { environmentId: null, current: true, inventory: { ...local, projects: [] } },
      { environmentId: 'env-remote', current: false, inventory: { ...remote, projects: [] } },
    ]
    render(<HubTree />)

    expect(screen.getByTestId(TestIds.hubInventory)).toHaveTextContent('Open a Git repository')
    expect(screen.queryByTestId(TestIds.hubProject('proj-alpha'))).toBeNull()
  })
})
