import type { HubInventory } from '@porcelain/contracts/projects'
import { hubInventorySchema, projectsContractFixtures } from '@porcelain/contracts/projects'
import { registerEnvironmentAlias } from '@renderer/lib/environment-sessions'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useNewTaskDialogStore } from '@renderer/stores/new-task-dialog'
import { TestIds } from '@shared/test-ids'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NewTaskDialog } from './new-task-dialog'
import {
  connectSecondaryEnvironment,
  DAEMON_HOST,
  disconnectSecondaryEnvironment,
  renderTasks,
  SECONDARY_ENVIRONMENT,
} from './test-support'

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

/** Live Hub inventories, swapped per test the way the two runtimes really vary. */
let inventories: readonly {
  environmentId: string | null
  current: boolean
  inventory: HubInventory
}[] = []

vi.mock('@renderer/features/projects', () => ({
  useHubInventories: () => inventories,
}))

/** Base UI's Select commits on the pointer sequence; a bare click leaves it unchosen. */
async function choose(trigger: HTMLElement, option: string): Promise<void> {
  fireEvent.click(trigger)
  const item = await screen.findByRole('option', { name: option })
  fireEvent.pointerDown(item, { pointerType: 'mouse' })
  fireEvent.pointerUp(item, { pointerType: 'mouse' })
  fireEvent.click(item)
}

/**
 * Connect the second Environment the browser way: a client-local session plus the alias the
 * real `useHubInventories` registers once that daemon answers with its announced id.
 */
function connectSecondEnvironmentWithInventory(inventory: HubInventory | null): void {
  connectSecondaryEnvironment([])
  registerEnvironmentAlias(remoteInventory.environment.id, SECONDARY_ENVIRONMENT.id)
  inventories = [
    { environmentId: null, current: true, inventory: localInventory },
    ...(inventory === null
      ? []
      : [{ environmentId: inventory.environment.id, current: false, inventory }]),
  ]
}

describe('NewTaskDialog', () => {
  beforeEach(() => {
    useNewTaskDialogStore.getState().show()
    inventories = [{ environmentId: null, current: true, inventory: localInventory }]
  })

  afterEach(() => {
    disconnectSecondaryEnvironment()
  })

  it('creates a Task from the title and the Hub project', async () => {
    const { mock } = renderTasks(<NewTaskDialog />)
    act(() => {
      useHubSelectionStore.setState({
        selection: {
          kind: 'worktree',
          environmentId: 'env-synthetic',
          projectId: 'proj-alpha',
          worktreeId: 'wt-alpha-main',
          path: '/synthetic/projects/alpha',
        },
      })
    })
    expect(screen.getByTestId(TestIds.tasksDialog)).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.tasksComposer)).toBeInTheDocument()

    fireEvent.change(screen.getByTestId(TestIds.tasksComposerTitle), {
      target: { value: 'Ship the rail' },
    })
    await waitFor(() =>
      expect(screen.getByTestId(TestIds.tasksComposerProject)).toHaveTextContent('alpha'),
    )
    fireEvent.click(screen.getByTestId(TestIds.tasksComposerSubmit))

    await waitFor(() => {
      expect(mock.requests().some((request) => request.procedure === 'createTask')).toBe(true)
    })
    const created = mock.requests().find((request) => request.procedure === 'createTask')
    expect(created?.input).toMatchObject({
      title: 'Ship the rail',
      references: { projectId: 'proj-alpha', worktreeId: 'wt-alpha-main' },
    })
    expect(useNewTaskDialogStore.getState().open).toBe(false)
  })

  it('refuses an empty title without calling the daemon', () => {
    const { mock } = renderTasks(<NewTaskDialog />)
    fireEvent.click(screen.getByTestId(TestIds.tasksComposerSubmit))
    expect(mock.requests().some((request) => request.procedure === 'createTask')).toBe(false)
    expect(screen.getByText('A Task needs a title.')).toBeInTheDocument()
  })

  it('does not ask which Environment while only one can answer', async () => {
    renderTasks(<NewTaskDialog />)
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksComposer)).toBeInTheDocument())
    expect(screen.queryByTestId(TestIds.tasksComposerEnvironment)).not.toBeInTheDocument()
  })

  /**
   * A Hub reaching two Environments has no "current" one. Filing the Task on whichever daemon
   * served the page would silently put it on the wrong machine, so the target is named or the
   * write is refused.
   */
  it('refuses to guess the Environment when more than one can answer', async () => {
    connectSecondaryEnvironment([])
    const { mock } = renderTasks(<NewTaskDialog />)
    const picker = await screen.findByTestId(TestIds.tasksComposerEnvironment)

    fireEvent.change(screen.getByTestId(TestIds.tasksComposerTitle), {
      target: { value: 'Ship the rail' },
    })
    fireEvent.click(screen.getByTestId(TestIds.tasksComposerSubmit))

    expect(
      await screen.findByText('Choose the Environment this Task belongs to before saving it.'),
    ).toBeInTheDocument()
    expect(mock.requests().some((request) => request.procedure === 'createTask')).toBe(false)
    expect(useNewTaskDialogStore.getState().open).toBe(true)

    fireEvent.click(picker)
    const option = await screen.findByRole('option', { name: SECONDARY_ENVIRONMENT.name })
    // Base UI's Select commits on the pointer sequence; a bare click leaves it unchosen.
    fireEvent.pointerDown(option, { pointerType: 'mouse' })
    fireEvent.pointerUp(option, { pointerType: 'mouse' })
    fireEvent.click(option)
    fireEvent.click(screen.getByTestId(TestIds.tasksComposerSubmit))

    // The chosen Environment is a client-local session, so the write leaves over its own
    // transport — never the daemon that served the page.
    await waitFor(() =>
      expect(
        vi
          .mocked(fetch)
          .mock.calls.some(
            ([input, init]) =>
              String(input).startsWith(SECONDARY_ENVIRONMENT.url) &&
              String(init?.body ?? '').includes('Ship the rail'),
          ),
      ).toBe(true),
    )
    expect(mock.requests().some((request) => request.procedure === 'createTask')).toBe(false)
  })

  /**
   * The complaint this answers: with two Environments in one Hub the Project list mixed both
   * machines' checkouts, so nothing on screen said which Project belonged to the Environment
   * the Task was about to be filed on.
   */
  it('narrows the Project list to the chosen Environment', async () => {
    connectSecondEnvironmentWithInventory(remoteInventory)
    renderTasks(<NewTaskDialog />)

    await choose(
      await screen.findByTestId(TestIds.tasksComposerEnvironment),
      SECONDARY_ENVIRONMENT.name,
    )
    fireEvent.click(screen.getByTestId(TestIds.tasksComposerProject))

    expect(await screen.findByRole('option', { name: 'remote-alpha' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'alpha' })).not.toBeInTheDocument()
  })

  /**
   * A Project id names a checkout on ONE daemon. Retargeting the Task has to drop it: a
   * selection that survived the switch would file the Task against a repository the receiving
   * Environment has never seen.
   */
  it('drops a Project chosen under the previous Environment', async () => {
    connectSecondEnvironmentWithInventory(remoteInventory)
    renderTasks(<NewTaskDialog />)

    const environment = await screen.findByTestId(TestIds.tasksComposerEnvironment)
    await choose(environment, DAEMON_HOST)
    await choose(screen.getByTestId(TestIds.tasksComposerProject), 'alpha')
    await waitFor(() =>
      expect(screen.getByTestId(TestIds.tasksComposerProject)).toHaveTextContent('alpha'),
    )

    await choose(environment, SECONDARY_ENVIRONMENT.name)
    await waitFor(() =>
      expect(screen.getByTestId(TestIds.tasksComposerProject)).toHaveTextContent('No project'),
    )

    fireEvent.change(screen.getByTestId(TestIds.tasksComposerTitle), {
      target: { value: 'Ship the rail' },
    })
    fireEvent.click(screen.getByTestId(TestIds.tasksComposerSubmit))

    const sent = await waitFor(() => {
      const call = vi
        .mocked(fetch)
        .mock.calls.find(([, init]) => String(init?.body ?? '').includes('Ship the rail'))
      if (call === undefined) throw new Error('the Task was never sent')
      return String(call[1]?.body ?? '')
    })
    expect(sent).not.toContain('proj-alpha')
  })

  it('says an Environment has no Projects instead of offering an empty picker', async () => {
    connectSecondEnvironmentWithInventory(null)
    renderTasks(<NewTaskDialog />)

    await choose(
      await screen.findByTestId(TestIds.tasksComposerEnvironment),
      SECONDARY_ENVIRONMENT.name,
    )
    await waitFor(() =>
      expect(screen.getByTestId(TestIds.tasksComposerProject)).toHaveTextContent(
        'No Projects on this Environment',
      ),
    )
  })

  it('offers no Project list until the Environment is named', async () => {
    connectSecondEnvironmentWithInventory(remoteInventory)
    renderTasks(<NewTaskDialog />)

    await screen.findByTestId(TestIds.tasksComposerEnvironment)
    const project = screen.getByTestId(TestIds.tasksComposerProject)
    expect(project).toHaveTextContent('Choose an Environment first')
    expect(project).toBeDisabled()
  })
})
