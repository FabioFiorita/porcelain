import { useNewTaskDialogStore } from '@renderer/stores/new-task-dialog'
import { TestIds } from '@shared/test-ids'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { NewTaskDialog } from './new-task-dialog'
import { renderTasks } from './test-support'

describe('NewTaskDialog', () => {
  beforeEach(() => {
    useNewTaskDialogStore.getState().show()
  })

  it('creates a Task from the title and shows coming-soon fields', async () => {
    const { mock } = renderTasks(<NewTaskDialog />)
    expect(screen.getByTestId(TestIds.tasksDialog)).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.tasksComingSoon('pictures'))).toHaveTextContent('Coming soon')
    expect(screen.getByTestId(TestIds.tasksComingSoon('files'))).toHaveTextContent('Coming soon')
    expect(screen.getByTestId(TestIds.tasksComingSoon('worktree'))).toHaveTextContent('Coming soon')

    fireEvent.change(screen.getByTestId(TestIds.tasksQuickAddTitle), {
      target: { value: 'Ship the rail' },
    })
    fireEvent.click(screen.getByTestId(TestIds.tasksQuickAddSubmit))

    await waitFor(() => {
      expect(mock.requests().some((request) => request.procedure === 'createTask')).toBe(true)
    })
    expect(useNewTaskDialogStore.getState().open).toBe(false)
  })
})
