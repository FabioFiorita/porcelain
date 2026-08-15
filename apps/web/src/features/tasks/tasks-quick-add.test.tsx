import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { TestIds } from '@shared/test-ids'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { TasksQuickAdd } from './tasks-quick-add'
import { renderTasks } from './test-support'

const LOCAL_ONLY = [{ id: null, name: 'This device' }]
const PROJECT_ID = 'project-synthetic'
const WORKTREE_ID = 'worktree-synthetic'
const LINK = 'https://example.invalid/issue/23'
const ATTACHMENT = '/synthetic/home/trace.log'

function selectWorktree(): void {
  useHubSelectionStore.setState({
    selection: {
      kind: 'worktree',
      environmentId: 'environment-a',
      projectId: PROJECT_ID,
      worktreeId: WORKTREE_ID,
      path: '/synthetic/repo',
    },
  })
}

const createRequests = (mock: { requests: () => readonly { procedure: string }[] }) =>
  mock.requests().filter((request) => request.procedure === 'createTask')

describe('TasksQuickAdd', () => {
  beforeEach(() => {
    useHubSelectionStore.setState({ selection: { kind: 'home' } })
  })

  it('files the Task against the Hub selection, with its link and attachment path', async () => {
    const { mock } = renderTasks(<TasksQuickAdd environments={LOCAL_ONLY} />)
    act(() => {
      selectWorktree()
    })

    fireEvent.change(screen.getByTestId(TestIds.tasksQuickAddTitle), {
      target: { value: '  Capture the follow-up  ' },
    })
    fireEvent.change(screen.getByTestId(TestIds.tasksQuickAddStatus), {
      target: { value: 'doing' },
    })
    fireEvent.change(screen.getByTestId(TestIds.tasksQuickAddTags), {
      target: { value: 'follow-up, release ' },
    })
    fireEvent.change(screen.getByTestId(TestIds.tasksQuickAddLinkUrl), {
      target: { value: LINK },
    })
    fireEvent.change(screen.getByTestId(TestIds.tasksQuickAddLinkLabel), {
      target: { value: 'Issue 23' },
    })
    fireEvent.change(screen.getByTestId(TestIds.tasksQuickAddAttachment), {
      target: { value: ATTACHMENT },
    })
    fireEvent.click(screen.getByTestId(TestIds.tasksQuickAddSubmit))

    await waitFor(() => expect(createRequests(mock)).toHaveLength(1))
    expect(mock.requests().filter((request) => request.procedure === 'createTask')).toEqual([
      {
        procedure: 'createTask',
        kind: 'mutation',
        input: {
          title: 'Capture the follow-up',
          status: 'doing',
          tags: ['follow-up', 'release'],
          references: { projectId: PROJECT_ID, worktreeId: WORKTREE_ID },
          links: [{ url: LINK, label: 'Issue 23' }],
          attachmentPaths: [ATTACHMENT],
        },
      },
    ])
    // The form clears itself only after the daemon accepted the Task.
    await waitFor(() => expect(screen.getByTestId(TestIds.tasksQuickAddTitle)).toHaveValue(''))
  })

  it('labels a link with its own URL when no label was typed', async () => {
    const { mock } = renderTasks(<TasksQuickAdd environments={LOCAL_ONLY} />)

    fireEvent.change(screen.getByTestId(TestIds.tasksQuickAddTitle), {
      target: { value: 'Read the run' },
    })
    fireEvent.change(screen.getByTestId(TestIds.tasksQuickAddLinkUrl), {
      target: { value: LINK },
    })
    fireEvent.click(screen.getByTestId(TestIds.tasksQuickAddSubmit))

    await waitFor(() => expect(createRequests(mock)).toHaveLength(1))
    expect(mock.requests().at(-1)?.input).toEqual({
      title: 'Read the run',
      status: 'todo',
      links: [{ url: LINK, label: LINK }],
    })
  })

  it('shows the refusal in the form when no Environment can be resolved', async () => {
    const { mock } = renderTasks(<TasksQuickAdd environments={[]} />)

    fireEvent.change(screen.getByTestId(TestIds.tasksQuickAddTitle), {
      target: { value: 'Nowhere to file this' },
    })
    fireEvent.click(screen.getByTestId(TestIds.tasksQuickAddSubmit))

    expect(
      await screen.findByText('Choose the Environment this Task belongs to before saving it.'),
    ).toBeInTheDocument()
    expect(createRequests(mock)).toEqual([])
    // The typed title survives the refusal — the person fixes the Environment, not the Task.
    expect(screen.getByTestId(TestIds.tasksQuickAddTitle)).toHaveValue('Nowhere to file this')
  })

  it('refuses a blank title and says so', async () => {
    const { mock } = renderTasks(<TasksQuickAdd environments={LOCAL_ONLY} />)

    fireEvent.change(screen.getByTestId(TestIds.tasksQuickAddTitle), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByTestId(TestIds.tasksQuickAddSubmit))

    expect(await screen.findByText('A Task needs a title.')).toBeInTheDocument()
    expect(createRequests(mock)).toEqual([])
  })

  it('submits on Enter in the title field', async () => {
    const { mock } = renderTasks(<TasksQuickAdd environments={LOCAL_ONLY} />)

    fireEvent.change(screen.getByTestId(TestIds.tasksQuickAddTitle), {
      target: { value: 'Typed and returned' },
    })
    fireEvent.keyDown(screen.getByTestId(TestIds.tasksQuickAddTitle), { key: 'Enter' })

    await waitFor(() => expect(createRequests(mock)).toHaveLength(1))
    expect(mock.requests().at(-1)?.input).toEqual({ title: 'Typed and returned', status: 'todo' })
  })
})
