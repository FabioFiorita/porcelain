import { hubInventorySchema, projectsContractFixtures } from '@porcelain/contracts/projects'
import { useWorktreeScriptsStore } from '@renderer/stores/worktree-scripts'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HubTreeFromInventories, HubTreeFromInventory } from './hub-tree-list'

vi.mock('@renderer/features/git', () => ({
  useGitBranches: () => ({ branches: [], isFetching: false }),
}))

const inventory = hubInventorySchema.parse(projectsContractFixtures.hubInventory.output)
const createdWorktree = inventory.projects[0]?.worktrees[1]

if (createdWorktree === undefined) {
  throw new Error('Hub inventory fixture must include a secondary Worktree')
}

const remoteInventory = hubInventorySchema.parse({
  ...inventory,
  environment: { ...inventory.environment, id: 'env-remote', name: 'remote' },
  projects: inventory.projects.map((project) => ({
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

describe('Hub inventory tree', () => {
  it('keeps equivalent Environment-local Projects distinct and routes remote removal', async () => {
    const openWorktree = vi.fn()
    const removeWorktree = vi.fn(async () => undefined)
    const removeProject = vi.fn(async () => undefined)
    const createWorktree = vi.fn(async () => createdWorktree)
    const local = { environmentId: null, current: true, inventory }
    const remote = { environmentId: 'env-remote', current: false, inventory: remoteInventory }
    render(
      <HubTreeFromInventories
        sources={[local, remote]}
        openWorktree={openWorktree}
        createWorktree={createWorktree}
        removeProject={removeProject}
        removeWorktree={removeWorktree}
      />,
    )

    const localProject = screen.getByTestId(TestIds.hubProject('proj-alpha'))
    const remoteProject = screen.getByTestId(TestIds.hubProject('remote-proj-alpha'))
    expect(localProject).toHaveTextContent('synthetic')
    expect(remoteProject).toHaveTextContent('remote')
    expect(screen.getByTestId(TestIds.hubCreateWorktree('proj-alpha'))).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.hubCreateWorktree('remote-proj-alpha'))).toBeInTheDocument()

    fireEvent.click(screen.getByTestId(TestIds.hubCreateWorktree('remote-proj-alpha')))
    fireEvent.change(screen.getByTestId(TestIds.hubCreateWorktreeBranch), {
      target: { value: 'feature/remote-review' },
    })
    fireEvent.click(screen.getByTestId(TestIds.hubCreateWorktreeSubmit))
    await waitFor(() =>
      expect(createWorktree).toHaveBeenCalledWith({
        projectId: 'remote-proj-alpha',
        branch: 'feature/remote-review',
        environmentId: 'env-remote',
      }),
    )

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree('remote-wt-alpha-main')))
    expect(openWorktree).toHaveBeenCalledWith(remote, remoteInventory.projects[0]?.worktrees[0])
    fireEvent.contextMenu(
      within(remoteProject).getByRole('button', { name: 'Collapse project alpha' }),
    )
    expect(screen.getByRole('menuitem', { name: 'Remove project' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove project' }))
    await waitFor(() =>
      expect(removeProject).toHaveBeenCalledWith('remote-proj-alpha', 'env-remote'),
    )

    fireEvent.contextMenu(screen.getByTestId(TestIds.hubWorktree('remote-wt-alpha-topic')))
    expect(screen.getByRole('menuitem', { name: /remove worktree/i })).toBeInTheDocument()
    fireEvent.click(screen.getByTestId(TestIds.hubRemoveWorktree('remote-wt-alpha-topic')))
    fireEvent.click(await screen.findByTestId(TestIds.hubRemoveWorktreeConfirm))
    await waitFor(() =>
      expect(removeWorktree).toHaveBeenCalledWith({
        projectId: 'remote-proj-alpha',
        worktreeId: 'remote-wt-alpha-topic',
        environmentId: 'env-remote',
        force: true,
      }),
    )
  })

  it('keeps the environment badge and project header separate from clickable Worktrees', () => {
    const openWorktree = vi.fn()
    render(
      <HubTreeFromInventory
        inventory={inventory}
        openWorktree={openWorktree}
        createWorktree={vi.fn(async () => createdWorktree)}
        removeProject={vi.fn(async () => undefined)}
        removeWorktree={vi.fn(async () => undefined)}
      />,
    )

    expect(screen.getByTestId(TestIds.hubInventory)).toBeInTheDocument()
    expect(screen.queryByTestId(TestIds.hubEnvironment(inventory.environment.id))).toBeNull()
    expect(screen.getByTestId(TestIds.hubProject('proj-alpha'))).toHaveTextContent('alpha')
    // One Environment names nothing: the badge only earns its space when there are two to
    // tell apart, which the multi-source case above asserts.
    expect(screen.getByTestId(TestIds.hubProject('proj-alpha'))).not.toHaveTextContent('synthetic')
    expect(screen.getByTestId(TestIds.hubWorktree('wt-alpha-main'))).toHaveTextContent('alpha')
    expect(screen.getByTestId(TestIds.hubCreateWorktree('proj-alpha'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete worktree/i })).toBeNull()
    expect(screen.queryByLabelText(/delete worktree/i)).toBeNull()

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Collapse project alpha' }))
    expect(screen.getByRole('menuitem', { name: 'Copy project path' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Personalization' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Remove project' })).toBeInTheDocument()
    // Lifecycle scripts moved into the Actions store; the Project menu no longer owns a
    // second, browser-local copy of them.
    expect(screen.queryByRole('menuitem', { name: 'Configure worktree setup' })).toBeNull()

    fireEvent.contextMenu(screen.getByTestId(TestIds.hubWorktree('wt-alpha-main')))
    // The primary checkout is the Project itself — git refuses to remove it.
    expect(screen.queryByRole('menuitem', { name: /remove worktree/i })).toBeNull()

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree('wt-alpha-main')))
    expect(openWorktree).toHaveBeenCalledTimes(1)

    fireEvent.contextMenu(screen.getByTestId(TestIds.hubWorktree('wt-alpha-topic')))
    expect(screen.getByRole('menuitem', { name: 'Copy name' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Copy path' })).toBeInTheDocument()
  })

  it('removes a Worktree only after the human confirms the deletion', async () => {
    const removeWorktree = vi.fn(async () => undefined)
    render(
      <HubTreeFromInventory
        inventory={inventory}
        openWorktree={vi.fn()}
        createWorktree={vi.fn(async () => createdWorktree)}
        removeProject={vi.fn(async () => undefined)}
        removeWorktree={removeWorktree}
      />,
    )

    fireEvent.contextMenu(screen.getByTestId(TestIds.hubWorktree('wt-alpha-topic')))
    fireEvent.click(screen.getByTestId(TestIds.hubRemoveWorktree('wt-alpha-topic')))

    // The dialog must survive the menu closing around it — mounted inside the menu it
    // would be unmounted in the same frame it opened, which is how this control shipped
    // dead once already.
    const dialog = await screen.findByTestId(TestIds.hubRemoveWorktreeDialog)
    expect(dialog).toBeInTheDocument()
    expect(removeWorktree).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId(TestIds.hubRemoveWorktreeConfirm))
    await waitFor(() =>
      expect(removeWorktree).toHaveBeenCalledWith({
        projectId: 'proj-alpha',
        worktreeId: 'wt-alpha-topic',
        environmentId: null,
        force: true,
      }),
    )
  })

  it('leaves the Worktree in place when the confirmation is cancelled', async () => {
    const removeWorktree = vi.fn(async () => undefined)
    render(
      <HubTreeFromInventory
        inventory={inventory}
        openWorktree={vi.fn()}
        createWorktree={vi.fn(async () => createdWorktree)}
        removeProject={vi.fn(async () => undefined)}
        removeWorktree={removeWorktree}
      />,
    )

    fireEvent.contextMenu(screen.getByTestId(TestIds.hubWorktree('wt-alpha-topic')))
    fireEvent.click(screen.getByTestId(TestIds.hubRemoveWorktree('wt-alpha-topic')))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByTestId(TestIds.hubRemoveWorktreeDialog)).toBeNull())
    expect(removeWorktree).not.toHaveBeenCalled()
  })

  it('opens the Worktree scripts of the Project the menu was raised on', () => {
    useWorktreeScriptsStore.setState({ target: null })
    render(
      <HubTreeFromInventory
        inventory={inventory}
        openWorktree={vi.fn()}
        createWorktree={vi.fn(async () => createdWorktree)}
        removeProject={vi.fn(async () => undefined)}
        removeWorktree={vi.fn(async () => undefined)}
      />,
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Collapse project alpha' }))
    fireEvent.click(screen.getByTestId(TestIds.hubWorktreeScripts('proj-alpha')))

    expect(useWorktreeScriptsStore.getState().target).toEqual({
      projectId: 'proj-alpha',
      projectName: 'alpha',
      environmentId: null,
      editable: true,
    })
  })

  it('offers editable scripts for a Project on a connected secondary Environment', () => {
    useWorktreeScriptsStore.setState({ target: null })
    render(
      <HubTreeFromInventories
        sources={[{ environmentId: 'env-remote', current: false, inventory: remoteInventory }]}
        openWorktree={vi.fn()}
        createWorktree={vi.fn(async () => createdWorktree)}
        removeProject={vi.fn(async () => undefined)}
        removeWorktree={vi.fn(async () => undefined)}
      />,
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Collapse project alpha' }))
    fireEvent.click(screen.getByTestId(TestIds.hubWorktreeScripts('remote-proj-alpha')))

    expect(useWorktreeScriptsStore.getState().target).toMatchObject({
      environmentId: 'env-remote',
      editable: true,
    })
  })

  it('collapses a Project without selecting it', () => {
    render(
      <HubTreeFromInventory
        inventory={inventory}
        openWorktree={vi.fn()}
        createWorktree={vi.fn(async () => createdWorktree)}
        removeProject={vi.fn(async () => undefined)}
        removeWorktree={vi.fn(async () => undefined)}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Collapse project alpha' }))
    expect(screen.queryByTestId(TestIds.hubWorktree('wt-alpha-main'))).toBeNull()
    expect(screen.queryByRole('button', { name: 'alpha' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Expand project alpha' }))
    expect(screen.getByTestId(TestIds.hubWorktree('wt-alpha-main'))).toBeInTheDocument()
  })

  it('restores a Project collapse choice for the same Environment after it reconnects', () => {
    window.localStorage.clear()
    const props = {
      inventory,
      openWorktree: vi.fn(),
      createWorktree: vi.fn(async () => createdWorktree),
      removeProject: vi.fn(async () => undefined),
      removeWorktree: vi.fn(async () => undefined),
    }
    const first = render(<HubTreeFromInventory {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse project alpha' }))
    expect(screen.queryByTestId(TestIds.hubWorktree('wt-alpha-main'))).toBeNull()
    first.unmount()

    render(<HubTreeFromInventory {...props} />)
    expect(screen.getByRole('button', { name: 'Expand project alpha' })).toBeInTheDocument()
    expect(screen.queryByTestId(TestIds.hubWorktree('wt-alpha-main'))).toBeNull()
  })

  it('shows a cached offline Environment but disables its Project actions', () => {
    render(
      <HubTreeFromInventories
        sources={[
          {
            environmentId: 'env-remote',
            current: false,
            offline: true,
            inventory: remoteInventory,
          },
        ]}
        openWorktree={vi.fn()}
        createWorktree={vi.fn(async () => createdWorktree)}
        removeProject={vi.fn(async () => undefined)}
        removeWorktree={vi.fn(async () => undefined)}
      />,
    )

    expect(screen.getAllByText('Offline').length).toBeGreaterThan(0)
    expect(screen.getByTestId(TestIds.hubWorktree('remote-wt-alpha-main'))).toBeDisabled()
    expect(screen.queryByTestId(TestIds.hubCreateWorktree('remote-proj-alpha'))).toBeNull()
  })
})
