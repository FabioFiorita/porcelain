import { DEFAULT_HIDDEN_TASK_COLUMN_IDS, TASK_COLUMN_IDS } from '@porcelain/client-runtime/tasks'
import { TestIds } from '@shared/test-ids'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useTaskColumnsStore } from './tasks-columns-store'
import { TasksView } from './tasks-view'
import {
  connectSecondaryEnvironment,
  DAEMON_HOST,
  disconnectSecondaryEnvironment,
  renderTasks,
  SECONDARY_ENVIRONMENT,
  TASKS,
  taskAt,
} from './test-support'

const REFERENCED = taskAt(1)

const columnHeaders = (): string[] =>
  screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent ?? '')
    .filter((label) => label !== '')

describe('TasksView', () => {
  afterEach(() => {
    disconnectSecondaryEnvironment()
  })

  beforeEach(() => {
    useTaskColumnsStore.setState({
      order: [...TASK_COLUMN_IDS],
      hidden: [...DEFAULT_HIDDEN_TASK_COLUMN_IDS],
    })
  })

  it('renders the short id, title, and project on the default columns', async () => {
    renderTasks(<TasksView />)
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksTable)).toBeInTheDocument())

    const row = within(screen.getByTestId(TestIds.tasksRow(REFERENCED.id)))
    expect(row.getByText(REFERENCED.shortId)).toBeInTheDocument()
    expect(row.getByText(REFERENCED.title)).toBeInTheDocument()
    expect(row.getByText('project-synthetic')).toBeInTheDocument()
    expect(columnHeaders()).toEqual(['ID', 'Status', 'Title', 'Project', 'URL', 'Updated'])
  })

  it('drops a hidden column from the table and keeps Title unhideable', async () => {
    renderTasks(<TasksView />)
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksTable)).toBeInTheDocument())
    expect(columnHeaders()).toContain('ID')
    expect(columnHeaders()).not.toContain('Tags')
    expect(columnHeaders()).not.toContain('Worktree')

    act(() => {
      useTaskColumnsStore.getState().toggle('project')
    })
    await waitFor(() => expect(columnHeaders()).not.toContain('Project'))
    expect(columnHeaders()).toContain('Title')

    act(() => {
      useTaskColumnsStore.getState().toggle('title')
    })
    expect(useTaskColumnsStore.getState().hidden).not.toContain('title')
    expect(columnHeaders()).toContain('Title')
    expect(screen.getByText(REFERENCED.title)).toBeInTheDocument()
  })

  it('counts the rows it is showing', async () => {
    renderTasks(<TasksView />)
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksTable)).toBeInTheDocument())
    expect(screen.getAllByRole('row')).toHaveLength(TASKS.length + 1)
    expect(screen.getByText(`${TASKS.length} Tasks`)).toBeInTheDocument()
    expect(screen.queryByTestId(TestIds.tasksEmpty)).not.toBeInTheDocument()
    expect(screen.queryByTestId(TestIds.tasksError)).not.toBeInTheDocument()
  })

  it('says an empty table is empty rather than showing nothing', async () => {
    renderTasks(<TasksView />, { listTasks: () => ({ ok: true, value: [] }) })
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksEmpty)).toBeInTheDocument())
    expect(screen.getByText(/No Tasks yet/)).toBeInTheDocument()
    expect(screen.getByText('0 Tasks')).toBeInTheDocument()
    expect(screen.queryByTestId(TestIds.tasksTable)).not.toBeInTheDocument()
    expect(screen.queryByTestId(TestIds.tasksError)).not.toBeInTheDocument()
  })

  it('filters by a tag or path, not only the title', async () => {
    renderTasks(<TasksView />)
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksTable)).toBeInTheDocument())
    fireEvent.change(screen.getByTestId(TestIds.tasksFilter), {
      target: { value: 'flaky' },
    })
    await waitFor(() => {
      expect(screen.getByTestId(TestIds.tasksRow(REFERENCED.id))).toBeInTheDocument()
      expect(screen.queryByTestId(TestIds.tasksRow(taskAt(0).id))).not.toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId(TestIds.tasksFilter), {
      target: { value: 'probe.ts' },
    })
    await waitFor(() => {
      expect(screen.getByTestId(TestIds.tasksRow(REFERENCED.id))).toBeInTheDocument()
      expect(screen.queryByTestId(TestIds.tasksRow(taskAt(0).id))).not.toBeInTheDocument()
    })
  })

  it('asks before deleting a row', async () => {
    const { mock } = renderTasks(<TasksView />)
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksTable)).toBeInTheDocument())
    fireEvent.click(screen.getByTestId(TestIds.tasksRowDelete(REFERENCED.id)))
    expect(screen.getByText(`Delete ${REFERENCED.shortId}?`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mock.requests().some((request) => request.procedure === 'deleteTask')).toBe(false)
    fireEvent.click(screen.getByTestId(TestIds.tasksRowDelete(REFERENCED.id)))
    fireEvent.click(screen.getByTestId(TestIds.tasksDeleteConfirm))
    await waitFor(() => {
      expect(mock.requests().some((request) => request.procedure === 'deleteTask')).toBe(true)
    })
  })

  it('opens the detail sheet when a row is clicked', async () => {
    renderTasks(<TasksView />)
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksTable)).toBeInTheDocument())
    fireEvent.click(screen.getByTestId(TestIds.tasksRow(REFERENCED.id)))
    const sheet = await screen.findByTestId(TestIds.tasksSheet)
    expect(within(sheet).getByText(REFERENCED.shortId)).toBeInTheDocument()
  })

  it('changes a status from the row without opening the detail sheet', async () => {
    renderTasks(<TasksView />)
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksTable)).toBeInTheDocument())

    fireEvent.click(screen.getByTestId(TestIds.tasksRowStatus(REFERENCED.id)))
    const option = await screen.findByRole('option', { name: 'Done' })
    fireEvent.click(option)

    // The option renders in a portal but still bubbles through the React tree to the row,
    // whose click opens the detail sheet. Picking a status is an edit, not a navigation.
    await waitFor(() => expect(screen.queryByTestId(TestIds.tasksSheet)).not.toBeInTheDocument())
  })

  it('keeps a failed read distinct from an empty table', async () => {
    renderTasks(<TasksView />, {
      listTasks: () => ({
        ok: false,
        error: {
          code: 'tasks.unavailable',
          category: 'unavailable',
          message: 'Tasks are unavailable.',
          retryable: true,
          requestId: '00000000-0000-4000-8000-000000000099',
        },
      }),
    })
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksError)).toBeInTheDocument())
    expect(screen.getByTestId(TestIds.tasksError).textContent).toContain('Tasks are unavailable.')
    expect(screen.queryByTestId(TestIds.tasksEmpty)).not.toBeInTheDocument()
    expect(screen.queryByTestId(TestIds.tasksTable)).not.toBeInTheDocument()
  })

  /**
   * The Environment column is the answer to "which machine is this Task on?", so it only exists
   * where that question has more than one answer: the Mac app and mobile fan out over every
   * connected Environment, a browser client is served by exactly one daemon.
   */
  it('hides the Environment column entirely while one Environment answers', async () => {
    renderTasks(<TasksView />)
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksTable)).toBeInTheDocument())

    expect(columnHeaders()).not.toContain('Environment')
    fireEvent.click(screen.getByTestId(TestIds.tasksColumnsMenu))
    expect(await screen.findByTestId(TestIds.tasksColumnToggle('title'))).toBeInTheDocument()
    expect(screen.queryByTestId(TestIds.tasksColumnToggle('environment'))).not.toBeInTheDocument()
  })

  it('names the Environment on every row once a second one answers', async () => {
    // Short ids are per daemon, so two Environments can both own a `T-1`. The rows must stay
    // two rows, told apart by the Environment name — never merged onto one short id.
    const collision = {
      ...taskAt(0),
      id: '00000000-0000-4000-8000-000000000099',
      title: 'Same short id, other machine',
    }
    connectSecondaryEnvironment([collision])
    renderTasks(<TasksView />)
    await waitFor(() => expect(columnHeaders()).toContain('Environment'))

    const local = within(screen.getByTestId(TestIds.tasksRow(taskAt(0).id)))
    const remote = within(screen.getByTestId(TestIds.tasksRow(collision.id)))
    expect(local.getByText(taskAt(0).shortId)).toBeInTheDocument()
    expect(remote.getByText(collision.shortId)).toBeInTheDocument()
    expect(local.getByText(DAEMON_HOST)).toBeInTheDocument()
    expect(remote.getByText(SECONDARY_ENVIRONMENT.name)).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(TASKS.length + 2)
  })
})
