import type { HubInventory } from '@porcelain/contracts/projects'
import { hubInventorySchema, projectsContractFixtures } from '@porcelain/contracts/projects'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Electron: environment routing now goes through environmentSessionFor/the alias table like
// the browser client, no shell round trip. Pin isBrowser false to exercise the shell identity
// shape (source.environmentId vs. source.inventory.environment.id); hub-tree.test.tsx covers
// the browser's multi-session route.
vi.mock('@renderer/lib/platform', () => ({ isBrowser: false, isE2E: false, isLinuxShell: false }))

const local = hubInventorySchema.parse(projectsContractFixtures.hubInventory.output)
const remote = hubInventorySchema.parse({
  ...local,
  environment: { ...local.environment, id: 'env-remote-daemon', name: 'remote' },
  projects: local.projects.map((project) => ({
    ...project,
    id: `remote-${project.id}`,
    environmentId: 'env-remote-daemon',
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

vi.mock('./project-data', () => ({
  useHubInventoriesState: () => ({ inventories, status: 'ready' }),
  useCreateHubWorktree: () => ({ create: vi.fn(), isPending: false }),
  useOpenProject: () => ({ open: openProject }),
  useRemoveHubProject: () => ({ remove: vi.fn(async () => undefined) }),
  useRemoveHubWorktree: () => ({ remove: vi.fn(async () => undefined) }),
  useSelectedProject: () => null,
}))

const { HubTree } = await import('./hub-tree')

const worktree = local.projects[0]?.worktrees[0]
if (worktree === undefined) throw new Error('Hub inventory fixture must include a Worktree')

beforeEach(() => {
  vi.clearAllMocks()
  useHubSelectionStore.getState().selectHome()
  inventories = [
    // Shell identities: null is the local daemon, the string is a saved environment group —
    // distinct from `inventory.environment.id`, the daemon-announced id routing now uses.
    { environmentId: null, current: true, inventory: local },
    { environmentId: 'group-remote', current: false, inventory: remote },
  ]
})

describe('HubTree on the Electron shell', () => {
  it("opens a Worktree on the window's own Environment through the window client", async () => {
    render(<HubTree />)

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree(worktree.id)))

    // The current source always routes with `environmentId: null` (this window's own
    // client, bypassing environmentSessionFor) — see hub-tree.tsx for the race it avoids.
    await waitFor(() =>
      expect(openProject).toHaveBeenCalledWith(worktree.path, { environmentId: null }),
    )
  })

  it('opens a Worktree on another Environment by its daemon-announced id, not the shell group id', async () => {
    render(<HubTree />)

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree(`remote-${worktree.id}`)))

    // Before the fix this called openProject with the SHELL group id ('group-remote'), which
    // the renderer's session resolver (localStorage connections only, always empty in
    // Electron) could not resolve — every remote Hub click toasted "The target Environment is
    // offline." The alias registered in hub-inventories.ts is what lets the daemon-announced
    // id here resolve to the live shell-sourced session.
    await waitFor(() =>
      expect(openProject).toHaveBeenCalledWith(worktree.path, {
        environmentId: remote.environment.id,
      }),
    )
    expect(useHubSelectionStore.getState().selection).toMatchObject({
      kind: 'worktree',
      environmentId: 'env-remote-daemon',
      worktreeId: `remote-${worktree.id}`,
    })
  })

  it('opens the local row by its daemon-announced id when this window is bound to a remote', async () => {
    inventories = [
      { environmentId: null, current: false, inventory: local },
      { environmentId: 'group-remote', current: true, inventory: remote },
    ]
    render(<HubTree />)

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree(worktree.id)))

    // The local row's shell identity (null) means "the local daemon" in shell-id space, not
    // "this window's client" — routing must use `inventory.environment.id` either way.
    await waitFor(() =>
      expect(openProject).toHaveBeenCalledWith(worktree.path, {
        environmentId: local.environment.id,
      }),
    )
  })
})
