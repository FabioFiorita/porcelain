import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useNewTaskDialogStore } from '@renderer/stores/new-task-dialog'
import { TestIds } from '@shared/test-ids'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { NewTaskDialog } from './new-task-dialog'
import { renderTasks } from './test-support'

describe('NewTaskDialog', () => {
  beforeEach(() => {
    useNewTaskDialogStore.getState().show()
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
})
