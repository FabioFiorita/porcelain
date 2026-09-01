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
let inventoryStatus: 'loading' | 'ready' | 'error' = 'ready'
const openProject = vi.fn(async () => undefined)
const openWindow = vi.fn()

vi.mock('./project-data', () => ({
  useHubInventoriesState: () => ({ inventories, status: inventoryStatus }),
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
  inventoryStatus = 'ready'
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

    await waitFor(() =>
      expect(useHubSelectionStore.getState().selection).toEqual({
        kind: 'worktree',
        environmentId: local.environment.id,
        projectId: localWorktree.projectId,
        worktreeId: localWorktree.id,
        path: localWorktree.path,
      }),
    )
    // openProject's environmentId is the session-routing identity (null = this window's
    // own client), never the persisted-selection identity above — passing the local
    // Environment's real id here made every local worktree switch look like an
    // unresolved remote session and fail as "offline".
    await waitFor(() =>
      expect(openProject).toHaveBeenCalledWith(localWorktree.path, {
        environmentId: null,
      }),
    )
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('opens a Worktree from another Environment in this window with its owner target', async () => {
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

  it('explains when no Environment is live', () => {
    inventories = []
    render(<HubTree />)

    expect(screen.getByText('No Environments are online.')).toBeVisible()
  })

  it.each([
    ['loading', 'Loading Projects…'],
    ['error', 'Projects are unavailable. Try again in a moment.'],
  ] as const)('renders the %s inventory state', (status, message) => {
    inventories = []
    inventoryStatus = status
    render(<HubTree />)

    expect(screen.getByText(message)).toBeVisible()
  })

  it('does not change selection when opening a Worktree fails', async () => {
    openProject.mockRejectedValueOnce(new Error('offline'))
    render(<HubTree />)

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree(localWorktree.id)))

    await waitFor(() => expect(openProject).toHaveBeenCalled())
    expect(useHubSelectionStore.getState().selection).toEqual({ kind: 'home' })
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
