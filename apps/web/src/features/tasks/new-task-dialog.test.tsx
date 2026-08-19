import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useNewTaskDialogStore } from '@renderer/stores/new-task-dialog'
import { TestIds } from '@shared/test-ids'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NewTaskDialog } from './new-task-dialog'
import {
  connectSecondaryEnvironment,
  disconnectSecondaryEnvironment,
  renderTasks,
  SECONDARY_ENVIRONMENT,
} from './test-support'

describe('NewTaskDialog', () => {
  beforeEach(() => {
    useNewTaskDialogStore.getState().show()
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
})
