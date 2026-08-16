import { projectsContractFixtures } from '@porcelain/contracts/projects'
import { TestIds } from '@shared/test-ids'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HubHomeSummary, HubProjectSummary } from './hub-summaries'

vi.mock('./project-data', () => ({
  useHubInventories: () => [
    {
      environmentId: null,
      current: true,
      inventory: projectsContractFixtures.hubInventory.output,
    },
  ],
}))

const { selectProject } = vi.hoisted(() => ({ selectProject: vi.fn() }))

vi.mock('@renderer/stores/hub-selection', () => ({
  useHubSelectionStore: (
    selector: (state: {
      selection: { kind: 'project'; environmentId: string; projectId: string }
      selectProject: (input: { environmentId: string; projectId: string }) => void
      selectWorktree: () => void
    }) => unknown,
  ) =>
    selector({
      selection: {
        kind: 'project',
        environmentId: 'env-synthetic',
        projectId: 'proj-alpha',
      },
      selectProject,
      selectWorktree: vi.fn(),
    }),
}))

describe('Hub summaries', () => {
  it('renders Home as an all-Environment status summary', () => {
    render(<HubHomeSummary />)
    expect(screen.getByTestId(TestIds.hubHome)).toHaveTextContent('Home')
    expect(screen.getByTestId(TestIds.hubHome)).toHaveTextContent('synthetic')
    expect(screen.getByTestId(TestIds.hubHome)).toHaveTextContent('alpha')
  })

  it('renders a Project summary with its Worktrees', () => {
    render(<HubProjectSummary />)
    expect(screen.getByTestId(TestIds.hubProjectSummary)).toHaveTextContent('alpha')
    expect(screen.getByTestId(TestIds.hubProjectSummary)).toHaveTextContent('2 Worktrees')
  })

  it('navigates Home to a Project summary target', () => {
    render(<HubHomeSummary />)
    within(screen.getByTestId(TestIds.hubHome)).getAllByRole('button')[0]?.click()
    expect(selectProject).toHaveBeenCalledWith({
      environmentId: 'env-synthetic',
      projectId: 'proj-alpha',
    })
  })
})
