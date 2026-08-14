import { hubInventorySchema, projectsContractFixtures } from '@porcelain/contracts/projects'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HubTreeFromInventory } from './hub-tree'

const inventory = hubInventorySchema.parse(projectsContractFixtures.hubInventory.output)

describe('Hub inventory tree', () => {
  it('lists Environments, Projects, and Worktrees and has no delete control', () => {
    render(
      <HubTreeFromInventory
        inventory={inventory}
        openWorktree={vi.fn()}
        openProject={vi.fn()}
        createWorktree={vi.fn(async () => undefined)}
      />,
    )

    expect(screen.getByTestId(TestIds.hubInventory)).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.hubEnvironment(inventory.environment.id))).toHaveTextContent(
      'synthetic',
    )
    expect(screen.getByTestId(TestIds.hubProject('proj-alpha'))).toHaveTextContent('alpha')
    expect(screen.getByTestId(TestIds.hubWorktree('wt-alpha-main'))).toHaveTextContent('alpha')
    expect(screen.getByTestId(TestIds.hubCreateWorktree('proj-alpha'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete worktree/i })).toBeNull()
    expect(screen.queryByLabelText(/delete worktree/i)).toBeNull()
  })

  it('selects Home from the Environment row', () => {
    const selectHome = vi.fn()
    render(
      <HubTreeFromInventory
        inventory={inventory}
        openWorktree={vi.fn()}
        openProject={vi.fn()}
        createWorktree={vi.fn(async () => undefined)}
        selectHome={selectHome}
      />,
    )
    fireEvent.click(screen.getByTestId(TestIds.hubEnvironment(inventory.environment.id)))
    expect(selectHome).toHaveBeenCalledTimes(1)
  })
})
