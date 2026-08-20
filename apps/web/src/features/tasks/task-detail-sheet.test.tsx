import type { TaskRow } from '@porcelain/client-runtime/tasks'
import type { HubInventory } from '@porcelain/contracts/projects'
import { hubInventorySchema, projectsContractFixtures } from '@porcelain/contracts/projects'
import { TestIds } from '@shared/test-ids'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskDetailSheet } from './task-detail-sheet'
import { renderTasks, taskAt } from './test-support'

const localInventory = hubInventorySchema.parse(projectsContractFixtures.hubInventory.output)
const remoteInventory = hubInventorySchema.parse({
  ...localInventory,
  environment: { ...localInventory.environment, id: 'env-remote', name: 'Beelink (work)' },
  projects: localInventory.projects.map((project) => ({
    ...project,
    id: `remote-${project.id}`,
    name: `remote-${project.name}`,
    environmentId: 'env-remote',
    worktrees: project.worktrees.map((worktree) => ({
      ...worktree,
      id: `remote-${worktree.id}`,
      projectId: `remote-${project.id}`,
    })),
  })),
})

/** Live Hub inventories, matching the mock idiom used by the composer's own tests. */
let inventories: readonly {
  environmentId: string | null
  current: boolean
  inventory: HubInventory
}[] = []

vi.mock('@renderer/features/projects', () => ({
  useHubInventories: () => inventories,
}))

describe('TaskDetailSheet', () => {
  /**
   * The complaint this answers: editing a Task offered every Environment's Projects, so
   * re-targeting it onto another machine's checkout was one click away — a checkout the
   * Task's own Environment daemon has never seen.
   */
  it("offers only the Task's own Environment Projects, never another Environment's", async () => {
    inventories = [
      { environmentId: null, current: true, inventory: localInventory },
      { environmentId: remoteInventory.environment.id, current: false, inventory: remoteInventory },
    ]
    const row: TaskRow = {
      task: taskAt(0),
      environmentId: remoteInventory.environment.id,
      environmentName: remoteInventory.environment.name,
    }

    renderTasks(<TaskDetailSheet row={row} onClose={() => {}} />)

    fireEvent.click(await screen.findByTestId(TestIds.tasksComposerProject))

    expect(await screen.findByRole('option', { name: 'remote-alpha' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'alpha' })).not.toBeInTheDocument()
  })
})
