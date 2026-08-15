import { deferred } from '@renderer/hooks/trpc-test-harness'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTasks } from './tasks-queries'
import { createTasksHarness, DAEMON_HOST, TASKS, taskAt } from './test-support'

/**
 * The browser path: `isBrowser` is true under vitest/jsdom, so `useTasks` reads `listTasks`
 * off the one daemon that served the page and labels every row with its host.
 */
describe('useTasks in the browser runtime', () => {
  it('renders the daemon table as rows labelled with the daemon host', async () => {
    const { mock, wrapper, shellOperations } = createTasksHarness()
    const { result } = renderHook(() => useTasks(), { wrapper })
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    expect(result.current.error).toBeNull()
    // The fixtures share an updatedAt, so the total order falls through to the Task id.
    expect(result.current.rows.map((row) => row.task.id)).toEqual(
      [...TASKS].map((task) => task.id).sort(),
    )
    expect(result.current.rows).toHaveLength(TASKS.length)
    expect(result.current.rows.every((row) => row.environmentId === null)).toBe(true)
    expect(result.current.rows.every((row) => row.environmentName === DAEMON_HOST)).toBe(true)
    expect(result.current.environments).toEqual([{ id: null, name: DAEMON_HOST }])
    expect(mock.requests().filter((request) => request.procedure === 'listTasks')).toContainEqual({
      procedure: 'listTasks',
      kind: 'query',
      input: undefined,
    })
    expect(mock.requests().some((request) => request.procedure === 'environmentTasks')).toBe(false)
    // Nothing reached the shell router: the browser client has no fan-out.
    expect(shellOperations.map((operation) => operation.path)).toEqual([])
  })

  it('carries the whole Task through to the row', async () => {
    const { wrapper } = createTasksHarness()
    const { result } = renderHook(() => useTasks(), { wrapper })
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    const referenced = taskAt(1)
    const row = result.current.rows.find((candidate) => candidate.task.id === referenced.id)
    expect(row?.task).toEqual(referenced)
  })

  it('distinguishes unloaded, empty, and failed Tasks reads', async () => {
    const pending = deferred<typeof TASKS>()
    const unloaded = createTasksHarness({
      listTasks: () => pending.promise.then((value) => ({ ok: true as const, value })),
    })
    const unloadedHook = renderHook(() => useTasks(), { wrapper: unloaded.wrapper })
    expect(unloadedHook.result.current).toEqual({
      rows: [],
      environments: [],
      error: null,
      isLoaded: false,
    })
    pending.resolve([])
    await waitFor(() => expect(unloadedHook.result.current.isLoaded).toBe(true))

    const empty = createTasksHarness({ listTasks: () => ({ ok: true, value: [] }) })
    const emptyHook = renderHook(() => useTasks(), { wrapper: empty.wrapper })
    await waitFor(() => expect(emptyHook.result.current.isLoaded).toBe(true))
    expect(emptyHook.result.current.rows).toEqual([])
    expect(emptyHook.result.current.error).toBeNull()
    // An empty table still names the Environment a Task could be filed on.
    expect(emptyHook.result.current.environments).toEqual([{ id: null, name: DAEMON_HOST }])

    const failed = createTasksHarness({
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
    const failedHook = renderHook(() => useTasks(), { wrapper: failed.wrapper })
    await waitFor(() => expect(failedHook.result.current.isLoaded).toBe(true))
    expect(failedHook.result.current.rows).toEqual([])
    expect(failedHook.result.current.environments).toEqual([])
    expect(failedHook.result.current.error).toContain('Tasks are unavailable.')
  })
})
