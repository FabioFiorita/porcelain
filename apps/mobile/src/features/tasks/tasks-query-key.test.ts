import { tasksTableQuery } from '@porcelain/client-runtime/tasks'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import {
  invalidateAllTasksQueries,
  invalidateTasksIdentities,
  isTasksTableQueryKey,
  tasksTableKey,
  tasksTableKeyFor,
} from './tasks-query-key'
import { LAPTOP_ID, STUDIO_ID } from './test-support'

describe('mobile Tasks query keys', () => {
  it('keys a table under the daemon prefix and the shared identity', () => {
    expect(tasksTableKey(STUDIO_ID)).toEqual([
      'daemon',
      STUDIO_ID,
      { domain: 'tasks', name: 'table', environmentId: STUDIO_ID },
    ])
    expect(isTasksTableQueryKey(tasksTableKey(STUDIO_ID))).toBe(true)
    expect(isTasksTableQueryKey(['daemon', STUDIO_ID, { domain: 'files', name: 'table' }])).toBe(
      false,
    )
  })

  it('gives two Environments two entries so neither can overwrite the other', () => {
    expect(tasksTableKey(STUDIO_ID)).not.toEqual(tasksTableKey(LAPTOP_ID))
  })

  it('refuses the browser client’s null Environment — a phone has no local daemon', () => {
    expect(tasksTableKeyFor(tasksTableQuery(null))).toBeNull()
  })

  it('invalidates exactly the identities it is handed', async () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()

    await invalidateTasksIdentities(queryClient, [
      tasksTableQuery(STUDIO_ID),
      tasksTableQuery(null),
    ])

    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tasksTableKey(STUDIO_ID), exact: true })
  })

  it('sweeps every Environment’s table on recovery, and nothing else', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(tasksTableKey(STUDIO_ID), [])
    queryClient.setQueryData(tasksTableKey(LAPTOP_ID), [])
    queryClient.setQueryData(['daemon', STUDIO_ID, { domain: 'files', name: 'tree' }], [])
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    await invalidateAllTasksQueries(queryClient)

    const predicate = invalidate.mock.calls[0]?.[0]?.predicate
    expect(predicate).toBeDefined()
    const swept = queryClient
      .getQueryCache()
      .findAll({ predicate })
      .map((query) => query.queryKey)
    expect(swept).toHaveLength(2)
  })
})
