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
  kind: 'action',
  order: 10,
  createdAt: 10,
  trusted: true,
}

const check: ActionView = {
  id: 'action-check',
  title: 'Run checks',
  command: 'make check',
  kind: 'action',
  order: 20,
  createdAt: 20,
  trusted: true,
}

/** Porcelain runs these; they must never appear among the rows a click runs. */
const install: ActionView = {
  id: 'script-install',
  title: 'Install deps',
  command: 'pnpm install',
  kind: 'worktree-setup',
  order: 30,
  createdAt: 30,
  trusted: true,
}

const teardown: ActionView = {
  id: 'script-teardown',
  title: 'Stop containers',
  command: 'docker compose down',
  kind: 'worktree-dispose',
  order: 40,
  createdAt: 40,
  trusted: false,
}

/** Every Project the daemon knows has its own roster, so a wrong id shows wrong rows. */
const rosters: Record<string, ActionView[]> = {
  'proj-alpha': [build, check, install, teardown],
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
  it('keeps Worktree lifecycle scripts out of the click list and shows them on their own', async () => {
    const { wrapper } = harness()
    render(<ActionsGroup />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId(TestIds.actionRun('Build'))).toBeInTheDocument()
    })

    // Both scripts are listed — under Worktree scripts, not among the Actions.
    const setupList = screen.getByTestId(TestIds.actionsScripts('worktree-setup'))
    const disposeList = screen.getByTestId(TestIds.actionsScripts('worktree-dispose'))
    expect(setupList).toHaveTextContent('pnpm install')
    expect(disposeList).toHaveTextContent('docker compose down')

    // A lifecycle row nobody has accepted still says so, with the same shield as an Action.
    expect(screen.getByTestId(TestIds.actionUnreviewed('Stop containers'))).toBeInTheDocument()

    // The Actions list itself holds only the two commands a click runs.
    const rows = screen
      .getAllByTestId(/^action-run-/)
      .filter((row) => setupList.contains(row) === false && disposeList.contains(row) === false)
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      TestIds.actionRun('Build'),
      TestIds.actionRun('Run checks'),
    ])
  })

  it('lists the selected Project’s saved commands', async () => {
    const { wrapper } = harness()
    render(<ActionsGroup />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId(TestIds.actionRun('Build'))).toHaveTextContent('make build')
    })
    expect(screen.getByTestId(TestIds.actionRun('Run checks'))).toHaveTextContent('make check')
    expect(screen.queryByTestId(TestIds.actionRun('Other project command'))).toBeNull()
    expect(screen.queryByTestId(TestIds.actionsNoProject)).toBeNull()
    expect(screen.queryByTestId(TestIds.actionsEmpty)).toBeNull()
    expect(screen.getByTestId(TestIds.actionsAdd)).toHaveTextContent('Add action')
    expect(screen.queryByText(/porcelain/i)).toBeNull()
  })

  it('shows the empty state with an add button when the Project has no Actions', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
      actions: () => ({ ok: true, value: [] }),
    })
    render(<ActionsGroup />, { wrapper })
    await waitFor(() => expect(screen.getByTestId(TestIds.actionsEmpty)).toBeInTheDocument())
    expect(screen.getByTestId(TestIds.actionsEmpty)).toHaveTextContent('No actions yet')
    expect(screen.getByTestId(TestIds.actionsEmpty)).toHaveTextContent(
      'Add a dev server, a test watcher, or anything you need to run in the terminal. Agents can add them here too.',
    )
    expect(screen.getByTestId(TestIds.actionsAdd)).toHaveTextContent('Add action')
    expect(screen.queryByRole('button', { name: /^Add action$/ })).toBeInTheDocument()
    expect(screen.queryByLabelText('Add action')).toBeNull()

    fireEvent.click(screen.getByTestId(TestIds.actionsAdd))
    expect(screen.getByRole('dialog', { name: 'New action' })).toBeInTheDocument()
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
    expect(screen.queryByTestId(TestIds.actionsEmpty)).toBeNull()
    await waitFor(() => expect(runs).toEqual([]))
    expect(create).not.toHaveBeenCalled()
  })
})
