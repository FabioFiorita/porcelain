import { hubInventorySchema, projectsContractFixtures } from '@porcelain/contracts/projects'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HubTreeFromInventory } from './hub-tree'

const inventory = hubInventorySchema.parse(projectsContractFixtures.hubInventory.output)
const createdWorktree = inventory.projects[0]?.worktrees[1]

if (createdWorktree === undefined) {
  throw new Error('Hub inventory fixture must include a secondary Worktree')
}

describe('Hub inventory tree', () => {
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
    expect(screen.getByTestId(TestIds.hubProject('proj-alpha'))).toHaveTextContent('synthetic')
    expect(screen.getByTestId(TestIds.hubWorktree('wt-alpha-main'))).toHaveTextContent('alpha')
    expect(screen.getByTestId(TestIds.hubCreateWorktree('proj-alpha'))).toBeInTheDocument()
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Collapse project alpha' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Configure worktree setup' }))
    expect(screen.getByTestId(TestIds.hubWorktreeSetupDialog)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Collapse project alpha' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete worktree/i })).toBeNull()
    expect(screen.queryByLabelText(/delete worktree/i)).toBeNull()

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Collapse project alpha' }))
    expect(screen.getByRole('menuitem', { name: 'Copy project path' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Remove project' })).toBeInTheDocument()

    fireEvent.contextMenu(screen.getByTestId(TestIds.hubWorktree('wt-alpha-main')))
    expect(screen.queryByRole('menuitem', { name: 'Remove worktree' })).toBeNull()

    fireEvent.click(screen.getByTestId(TestIds.hubWorktree('wt-alpha-main')))
    expect(openWorktree).toHaveBeenCalledTimes(1)

    fireEvent.contextMenu(screen.getByTestId(TestIds.hubWorktree('wt-alpha-topic')))
    expect(screen.getByRole('menuitem', { name: 'Copy name' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Copy path' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Remove worktree' })).toBeInTheDocument()
  })

  it('confirms removal of a non-primary Worktree before invoking the mutation', async () => {
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
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove worktree' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('uncommitted changes')
    fireEvent.click(screen.getByRole('button', { name: 'Remove worktree' }))

    await waitFor(() => {
      expect(removeWorktree).toHaveBeenCalledWith({
        projectId: 'proj-alpha',
        worktreeId: 'wt-alpha-topic',
      })
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
})
