import { tasksContractFixtures } from '@porcelain/contracts/tasks'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { useQueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MissingEnvironmentTargetError, useTaskActions } from './tasks-mutations'
import { tasksKeyForEnvironment } from './tasks-query-key'
import { createTasksHarness, DAEMON_HOST, taskAt } from './test-support'

/**
 * Writing to a table that shows several machines.
 *
 * The safety property under test is that an unresolvable Environment is REFUSED rather than
 * routed somewhere plausible: `undefined` (nothing selected, or an Environment that went
 * away) never reaches a transport, while `null` — the daemon that served this page — does.
 */

const OTHER_ENVIRONMENT = 'environment-b'
const CREATE_INPUT = tasksContractFixtures.createTask.input
const TASK = taskAt(0)

function mountActions(handlers: Parameters<typeof createTasksHarness>[0] = {}) {
  const harness = createTasksHarness(handlers)
  const hook = renderHook(
    () => ({
      actions: useTaskActions(),
      daemon: useDaemonIdentity(),
      queryClient: useQueryClient(),
    }),
    { wrapper: harness.wrapper },
  )
  return { ...harness, hook }
}

async function readyActions(handlers: Parameters<typeof createTasksHarness>[0] = {}) {
  const mounted = mountActions(handlers)
  await waitFor(() => expect(mounted.hook.result.current.daemon.host).toBe(DAEMON_HOST))
  return mounted
}

describe('useTaskActions target resolution', () => {
  it('refuses every write with an unresolvable Environment and calls no transport', async () => {
    const { mock, shellOperations, hook } = await readyActions()

    await expect(hook.result.current.actions.add(undefined, CREATE_INPUT)).rejects.toBeInstanceOf(
      MissingEnvironmentTargetError,
    )
    await expect(
      hook.result.current.actions.update(undefined, { taskId: TASK.id, status: 'done' }),
    ).rejects.toBeInstanceOf(MissingEnvironmentTargetError)
    await expect(hook.result.current.actions.remove(undefined, TASK.id)).rejects.toBeInstanceOf(
      MissingEnvironmentTargetError,
    )

    expect(
      mock
        .requests()
        .map((request) => request.procedure)
        .filter((procedure) => procedure !== 'daemonInfo'),
    ).toEqual([])
    expect(shellOperations).toEqual([])
  })

  it('says which move fixes it rather than failing silently', async () => {
    const { hook } = await readyActions()
    await expect(hook.result.current.actions.add(undefined, CREATE_INPUT)).rejects.toThrow(
      'Choose the Environment this Task belongs to before saving it.',
    )
  })

  it('refuses another Environment in the browser instead of writing to the local daemon', async () => {
    const { mock, shellOperations, hook } = await readyActions()

    await expect(
      hook.result.current.actions.add(OTHER_ENVIRONMENT, CREATE_INPUT),
    ).rejects.toBeInstanceOf(MissingEnvironmentTargetError)
    await expect(
      hook.result.current.actions.update(OTHER_ENVIRONMENT, { taskId: TASK.id, status: 'done' }),
    ).rejects.toBeInstanceOf(MissingEnvironmentTargetError)
    await expect(
      hook.result.current.actions.remove(OTHER_ENVIRONMENT, TASK.id),
    ).rejects.toBeInstanceOf(MissingEnvironmentTargetError)

    expect(mock.requests().some((request) => request.procedure.endsWith('Task'))).toBe(false)
    expect(shellOperations).toEqual([])
  })

  it('writes to the directly-connected daemon when the target is null', async () => {
    const { mock, hook } = await readyActions()

    await act(async () => {
      await hook.result.current.actions.add(null, CREATE_INPUT)
    })
    await act(async () => {
      await hook.result.current.actions.update(null, { taskId: TASK.id, status: 'done' })
    })
    await act(async () => {
      await hook.result.current.actions.remove(null, TASK.id)
    })

    expect(
      mock
        .requests()
        .filter((request) => request.procedure !== 'daemonInfo')
        .map((request) => ({ procedure: request.procedure, input: request.input })),
    ).toEqual([
      { procedure: 'createTask', input: CREATE_INPUT },
      { procedure: 'updateTask', input: { taskId: TASK.id, status: 'done' } },
      { procedure: 'deleteTask', input: { taskId: TASK.id } },
    ])
  })

  it('returns the created Task the daemon answered with', async () => {
    const { hook } = await readyActions()
    let created: Awaited<ReturnType<typeof hook.result.current.actions.add>> | undefined
    await act(async () => {
      created = await hook.result.current.actions.add(null, CREATE_INPUT)
    })
    expect(created).toEqual(tasksContractFixtures.createTask.output)
  })
})

describe('useTaskActions cache consequences', () => {
  it('invalidates the written Environment table after each mutation settles', async () => {
    const cases: readonly {
      readonly name: string
      readonly run: (actions: ReturnType<typeof useTaskActions>) => Promise<unknown>
    }[] = [
      { name: 'create', run: (actions) => actions.add(null, CREATE_INPUT) },
      {
        name: 'update',
        run: (actions) => actions.update(null, { taskId: TASK.id, status: 'done' }),
      },
      { name: 'delete', run: (actions) => actions.remove(null, TASK.id) },
    ]

    for (const testCase of cases) {
      const { hook } = await readyActions()
      const daemon = hook.result.current.daemon
      const scope = { host: daemon.host, version: daemon.version }
      const localKey = tasksKeyForEnvironment(scope, null)
      const otherKey = tasksKeyForEnvironment(scope, OTHER_ENVIRONMENT)
      hook.result.current.queryClient.setQueryData(localKey, [TASK])
      hook.result.current.queryClient.setQueryData(otherKey, [TASK])

      await act(async () => {
        await testCase.run(hook.result.current.actions)
      })

      expect(hook.result.current.queryClient.getQueryState(localKey)?.isInvalidated).toBe(true)
      // Only the Environment that was written to went stale.
      expect(hook.result.current.queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false)
      hook.unmount()
    }
  })

  it('still invalidates the table when the write fails', async () => {
    const { hook } = await readyActions({
      createTask: () => ({
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
    const daemon = hook.result.current.daemon
    const localKey = tasksKeyForEnvironment({ host: daemon.host, version: daemon.version }, null)
    hook.result.current.queryClient.setQueryData(localKey, [TASK])

    await expect(hook.result.current.actions.add(null, CREATE_INPUT)).rejects.toThrow(
      'Tasks are unavailable.',
    )
    await waitFor(() =>
      expect(hook.result.current.queryClient.getQueryState(localKey)?.isInvalidated).toBe(true),
    )
  })
})
