import type { ActionView, PrepareActionRunInput } from '@porcelain/contracts/actions'
import type { HubInventory } from '@porcelain/contracts/projects'
import { hubInventorySchema, projectsContractFixtures } from '@porcelain/contracts/projects'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { setPrimaryEnvironmentId } from '@renderer/lib/environment-sessions'
import type { spawnLocalTerminal as spawnLocalTerminalModule } from '@renderer/lib/terminal-actions'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Hub's Actions menu is where an agent-authored command meets a human click, so
 * the two questions this suite keeps honest are "whose commands am I looking at" and
 * "which checkout would this run in" (#24). Everything below the daemon seam is
 * mocked; the target the daemon is asked to authorize is asserted exactly.
 */

const inventory: HubInventory = hubInventorySchema.parse(
  projectsContractFixtures.hubInventory.output,
)

const project = inventory.projects[0]
if (project === undefined) throw new Error('Hub inventory fixture must include a Project')
const mainWorktree = project.worktrees[0]
const topicWorktree = project.worktrees[1]
if (mainWorktree === undefined || topicWorktree === undefined) {
  throw new Error('Hub inventory fixture must include two Worktrees')
}

let inventories: readonly {
  environmentId: string | null
  current: boolean
  inventory: HubInventory
}[] = []

const create = vi.fn(async () => 'term-1')
const openPanel = vi.fn()
const spawnLocalTerminal = vi.fn<typeof spawnLocalTerminalModule>(async () => {})

vi.mock('@renderer/features/projects', () => ({
  useHubInventories: () => inventories,
}))

vi.mock('@renderer/hooks/use-local-terminal', () => ({
  useLocalDaemon: () => undefined,
  useLocalTerminalPath: () => null,
}))

vi.mock('@renderer/stores/terminals', () => ({
  useTerminalsStore: {
    getState: () => ({ create, openPanel }),
  },
}))

vi.mock('@renderer/lib/terminal-actions', () => ({
  spawnLocalTerminal: (...args: Parameters<typeof spawnLocalTerminalModule>) =>
    spawnLocalTerminal(...args),
}))

const { ActionsGroup } = await import('./actions-group')

const build: ActionView = {
  id: 'action-build',
  title: 'Build',
  command: 'make build',
  order: 10,
  createdAt: 10,
  trusted: true,
}

const check: ActionView = {
  id: 'action-check',
  title: 'Run checks',
  command: 'make check',
  order: 20,
  createdAt: 20,
  trusted: true,
}

/** Every Project the daemon knows has its own roster, so a wrong id shows wrong rows. */
const rosters: Record<string, ActionView[]> = {
  'proj-alpha': [build, check],
  'proj-beta': [{ ...build, id: 'action-other', title: 'Other project command' }],
}

function harness(): {
  wrapper: ReturnType<typeof createValidatingTrpcHarness>['wrapper']
  runs: PrepareActionRunInput[]
} {
  const runs: PrepareActionRunInput[] = []
  const { wrapper } = createValidatingTrpcHarness({
    daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    actions: (input) => {
      const { projectId } = input as { projectId: string }
      return { ok: true, value: rosters[projectId] ?? [] }
    },
    prepareActionRun: (input) => {
      const parsed = input as PrepareActionRunInput
      runs.push(parsed)
      const action = rosters['proj-alpha']?.find((a) => a.id === parsed.actionId)
      return {
        ok: true,
        value: {
          id: parsed.actionId,
          title: action?.title ?? 'Unknown',
          command: action?.command ?? 'noop',
          where: 'primary',
          cwd: parsed.target.path,
        },
      }
    },
  })
  return { wrapper, runs }
}

beforeEach(() => {
  vi.clearAllMocks()
  setPrimaryEnvironmentId(inventory.environment.id)
  create.mockResolvedValue('term-1')
  spawnLocalTerminal.mockResolvedValue(undefined)
  inventories = [{ environmentId: null, current: true, inventory }]
  useHubSelectionStore.setState({
    selection: {
      kind: 'worktree',
      environmentId: inventory.environment.id,
      projectId: project.id,
      worktreeId: mainWorktree.id,
      path: mainWorktree.path,
    },
  })
})

describe('ActionsGroup', () => {
  it('lists the selected Project’s saved commands', async () => {
    const { wrapper } = harness()
    render(<ActionsGroup />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId(TestIds.actionRun('Build'))).toHaveTextContent('make build')
    })
    expect(screen.getByTestId(TestIds.actionRun('Run checks'))).toHaveTextContent('make check')
    expect(screen.queryByTestId(TestIds.actionRun('Other project command'))).toBeNull()
    expect(screen.queryByTestId(TestIds.actionsNoProject)).toBeNull()
  })

  it('runs against the Worktree the Hub selection names', async () => {
    const { wrapper, runs } = harness()
    render(<ActionsGroup />, { wrapper })

    await waitFor(() => expect(screen.getByTestId(TestIds.actionRun('Build'))).toBeInTheDocument())
    fireEvent.click(screen.getByTestId(TestIds.actionRun('Build')))

    await waitFor(() => expect(runs).toHaveLength(1))
    expect(runs).toEqual([
      {
        actionId: 'action-build',
        target: {
          environmentId: inventory.environment.id,
          projectId: project.id,
          worktreeId: mainWorktree.id,
          path: mainWorktree.path,
        },
      },
    ])
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenCalledWith({
      cwd: mainWorktree.path,
      name: 'Build',
      initialInput: 'make build',
    })
    expect(screen.queryByTestId(TestIds.actionsTargetPicker)).toBeNull()
  })

  it('asks which Worktree when the selection is a Project, and runs in the one picked', async () => {
    useHubSelectionStore.setState({
      selection: {
        kind: 'project',
        environmentId: inventory.environment.id,
        projectId: project.id,
      },
    })
    const { wrapper, runs } = harness()
    render(<ActionsGroup />, { wrapper })

    await waitFor(() => expect(screen.getByTestId(TestIds.actionRun('Build'))).toBeInTheDocument())
    fireEvent.click(screen.getByTestId(TestIds.actionRun('Build')))

    await waitFor(() => expect(screen.getByTestId(TestIds.actionsTargetPicker)).toBeInTheDocument())
    // Nothing runs while the question is open.
    expect(runs).toEqual([])
    expect(create).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId(TestIds.actionsTargetOption(topicWorktree.id)))

    await waitFor(() => expect(runs).toHaveLength(1))
    expect(runs).toEqual([
      {
        actionId: 'action-build',
        target: {
          environmentId: inventory.environment.id,
          projectId: project.id,
          worktreeId: topicWorktree.id,
          path: topicWorktree.path,
        },
      },
    ])
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        cwd: topicWorktree.path,
        name: 'Build',
        initialInput: 'make build',
      }),
    )
  })

  it('says so and lists nothing when no Project is selected', async () => {
    useHubSelectionStore.setState({ selection: { kind: 'home' } })
    const { wrapper, runs } = harness()
    render(<ActionsGroup />, { wrapper })

    expect(screen.getByTestId(TestIds.actionsNoProject)).toHaveTextContent(
      'Select a Project to see its saved commands.',
    )
    expect(screen.queryByTestId(TestIds.actionRun('Build'))).toBeNull()
    expect(screen.queryByTestId(TestIds.actionsAdd)).toBeNull()
    await waitFor(() => expect(runs).toEqual([]))
    expect(create).not.toHaveBeenCalled()
  })
})
