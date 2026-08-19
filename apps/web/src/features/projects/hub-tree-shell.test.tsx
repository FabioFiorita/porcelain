import type { HubInventory } from '@porcelain/contracts/projects'
import { hubInventorySchema, projectsContractFixtures } from '@porcelain/contracts/projects'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Electron: the renderer holds exactly one daemon client — its window's — so a Hub row on
// any other Environment cannot be opened here at all. Pin isBrowser false to exercise that
// shell route; hub-tree.test.tsx covers the browser's multi-session route.
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
let openWorktreeInEnvironment = vi.fn(async () => undefined)

vi.mock('./project-data', () => ({
  useHubInventories: () => inventories,
  useCreateHubWorktree: () => ({ create: vi.fn(), isPending: false }),
  useOpenProject: () => ({ open: openProject }),
  useRemoveHubProject: () => ({ remove: vi.fn(async () => undefined) }),
  useRemoveHubWorktree: () => ({ remove: vi.fn(async () => undefined) }),
  useSelectedProject: () => null,
}))

vi.mock('@renderer/lib/trpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@renderer/lib/trpc')>()),
  shellTrpcClient: {
    openWorktreeInEnvironment: { mutate: (input: unknown) => openWorktreeInEnvironment(input) },
  },
}))

const { HubTree } = await import('./hub-tree')

const worktree = local.projects[0]?.worktrees[0]
if (worktree === undefined) throw new Error('Hub inventory fixture must include a Worktree')

beforeEach(() => {
  vi.clearAllMocks()
  openWorktreeInEnvironment = vi.fn(async () => undefined)
  useHubSelectionStore.getState().selectHome()
  inventories = [
    // Shell identities: null is the local daemon, the string is a saved environment group.
    { environmentId: null, current: true, inventory: local },
    { environmentId: 'group-remote', current: false, inventory: remote },
  ]
})

describe('HubTree on the Electron shell', () => {
  it("opens a Worktree on the window's own Environment through the window client", async () => {
    render(<HubTree />)

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree(worktree.id)))

    await waitFor(() =>
      expect(openProject).toHaveBeenCalledWith(worktree.path, { environmentId: null }),
    )
    expect(openWorktreeInEnvironment).not.toHaveBeenCalled()
  })

  it('routes a Worktree on another Environment through the shell instead of failing offline', async () => {
    render(<HubTree />)

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree(`remote-${worktree.id}`)))

    // Before the fix this called openProject with the SHELL group id, which the renderer's
    // session resolver (localStorage connections only, always empty in Electron) could not
    // resolve — every remote Hub click toasted "The target Environment is offline."
    await waitFor(() =>
      expect(openWorktreeInEnvironment).toHaveBeenCalledWith({
        environmentId: 'group-remote',
        repoPath: worktree.path,
      }),
    )
    // The shell reloads this window and the Hub selection survives that reload, so it has
    // to already name the destination — a selection left on the origin Environment restores
    // with an id that is no longer primary and every panel keyed off it reads "offline".
    expect(useHubSelectionStore.getState().selection).toMatchObject({
      kind: 'worktree',
      environmentId: 'env-remote-daemon',
      worktreeId: `remote-${worktree.id}`,
    })
    expect(openProject).not.toHaveBeenCalled()
  })

  it('puts the Hub selection back when the shell refuses the switch', async () => {
    openWorktreeInEnvironment = vi.fn(async () => {
      throw new Error('That environment no longer exists')
    })
    render(<HubTree />)

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree(`remote-${worktree.id}`)))

    // No reload happened, so the tree must not sit on an Environment this window never
    // switched to.
    await waitFor(() => expect(useHubSelectionStore.getState().selection).toEqual({ kind: 'home' }))
  })

  it('routes the local row through the shell when this window is bound to a remote', async () => {
    inventories = [
      { environmentId: null, current: false, inventory: local },
      { environmentId: 'group-remote', current: true, inventory: remote },
    ]
    render(<HubTree />)

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree(worktree.id)))

    // The local row's null means "the local daemon", not "this window's client": opening it
    // directly asked the bound REMOTE daemon for a local path — "The Project path was not found."
    await waitFor(() =>
      expect(openWorktreeInEnvironment).toHaveBeenCalledWith({
        environmentId: null,
        repoPath: worktree.path,
      }),
    )
    expect(openProject).not.toHaveBeenCalled()
  })
})
