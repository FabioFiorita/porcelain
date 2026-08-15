import { DEFAULT_HIDDEN_TASK_COLUMN_IDS, TASK_COLUMN_IDS } from '@porcelain/client-runtime/tasks'
import { TestIds } from '@shared/test-ids'
import { act, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTaskColumnsStore } from './tasks-columns-store'
import { TasksView } from './tasks-view'
import { DAEMON_HOST, renderTasks, TASKS, taskAt } from './test-support'

const REFERENCED = taskAt(1)

const columnHeaders = (): string[] =>
  screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent ?? '')
    .filter((label) => label !== '')

describe('TasksView', () => {
  beforeEach(() => {
    useTaskColumnsStore.setState({
      order: [...TASK_COLUMN_IDS],
      hidden: [...DEFAULT_HIDDEN_TASK_COLUMN_IDS],
    })
  })

  it('renders the references a Task carries, in their own columns', async () => {
    act(() => {
      useTaskColumnsStore.setState({ hidden: [] })
    })
    renderTasks(<TasksView />)
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksTable)).toBeInTheDocument())

    const row = within(screen.getByTestId(TestIds.tasksRow(REFERENCED.id)))
    expect(row.getByText(REFERENCED.title)).toBeInTheDocument()
    // Long ids are shortened for the cell, so match on the prefix the table shows.
    expect(row.getByText(/^project-synt/)).toBeInTheDocument()
    expect(row.getByText(/^worktree-syn/)).toBeInTheDocument()
    expect(row.getByText(DAEMON_HOST)).toBeInTheDocument()
    expect(columnHeaders()).toEqual([
      'Status',
      'Title',
      'Tags',
      'Project',
      'Environment',
      'Worktree',
      'Updated',
    ])
  })

  it('drops a hidden column from the table and keeps Title unhideable', async () => {
    renderTasks(<TasksView />)
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksTable)).toBeInTheDocument())
    expect(columnHeaders()).toContain('Tags')
    // 'worktree' is hidden by default, so the vocabulary is not the same as the view.
    expect(columnHeaders()).not.toContain('Worktree')

    act(() => {
      useTaskColumnsStore.getState().toggle('tags')
    })
    await waitFor(() => expect(columnHeaders()).not.toContain('Tags'))
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
})
