import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { applyTasksFreshnessRequirement, applyTasksNotification } from './tasks-notifications'
import { tasksTableKey } from './tasks-query-key'
import { LAPTOP_ID, STUDIO_ID } from './test-support'

describe('mobile Tasks notifications', () => {
  it('marks only the delivering Environment’s table stale', async () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()

    applyTasksNotification({ kind: 'tasks.changed' }, { queryClient, environmentId: STUDIO_ID })
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalled())

    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tasksTableKey(STUDIO_ID), exact: true })
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: tasksTableKey(LAPTOP_ID),
      exact: true,
    })
  })

  it('refetches every Environment after a sequence gap', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(tasksTableKey(STUDIO_ID), [])
    queryClient.setQueryData(tasksTableKey(LAPTOP_ID), [])
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    applyTasksFreshnessRequirement({ reason: 'gap' } as never, {
      queryClient,
      environmentId: STUDIO_ID,
    })
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalled())

    const predicate = invalidate.mock.calls[0]?.[0]?.predicate
    expect(queryClient.getQueryCache().findAll({ predicate })).toHaveLength(2)
  })
})
