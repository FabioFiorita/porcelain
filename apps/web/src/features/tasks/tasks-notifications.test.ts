import type { SessionChange } from '@porcelain/contracts/session'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import {
  applyTasksNotification,
  invalidateAllTasks,
  subscribeTasksSessions,
} from './tasks-notifications'
import { tasksKeyForEnvironment } from './tasks-query-key'

const PRIMARY_DAEMON = { host: 'beelink', version: '0.52.1' }
const SECONDARY_DAEMON = { host: 'environment-secondary', version: '0.52.1' }
const PRIMARY_ENVIRONMENT = null
const SECONDARY_ENVIRONMENT = 'environment-secondary'

describe('Web Tasks notifications', () => {
  it('refreshes only the Environment whose live session delivered the notification', () => {
    const queryClient = new QueryClient()
    const primaryKey = tasksKeyForEnvironment(PRIMARY_DAEMON, PRIMARY_ENVIRONMENT)
    const secondaryKey = tasksKeyForEnvironment(SECONDARY_DAEMON, SECONDARY_ENVIRONMENT)
    queryClient.setQueryData(primaryKey, ['primary'])
    queryClient.setQueryData(secondaryKey, ['secondary'])

    applyTasksNotification(
      { kind: 'tasks.changed' },
      {
        queryClient,
        daemon: SECONDARY_DAEMON,
        environmentId: SECONDARY_ENVIRONMENT,
      },
    )

    expect(queryClient.getQueryState(secondaryKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(primaryKey)?.isInvalidated).toBeFalsy()
  })

  it('recovers every canonical Environment table and ignores legacy query layouts', async () => {
    const queryClient = new QueryClient()
    const primaryKey = tasksKeyForEnvironment(PRIMARY_DAEMON, PRIMARY_ENVIRONMENT)
    const secondaryKey = tasksKeyForEnvironment(SECONDARY_DAEMON, SECONDARY_ENVIRONMENT)
    queryClient.setQueryData(primaryKey, ['primary'])
    queryClient.setQueryData(secondaryKey, ['secondary'])
    queryClient.setQueryData(['browser', 'tasks', SECONDARY_ENVIRONMENT], ['legacy'])

    await invalidateAllTasks(queryClient)

    expect(queryClient.getQueryState(primaryKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(secondaryKey)?.isInvalidated).toBe(true)
    expect(
      queryClient.getQueryState(['browser', 'tasks', SECONDARY_ENVIRONMENT])?.isInvalidated,
    ).toBeFalsy()
  })

  it('subscribes secondary sessions by alias and removes their listeners with the revision', () => {
    const queryClient = new QueryClient()
    const primaryKey = tasksKeyForEnvironment(PRIMARY_DAEMON, PRIMARY_ENVIRONMENT)
    const secondaryKey = tasksKeyForEnvironment(SECONDARY_DAEMON, SECONDARY_ENVIRONMENT)
    queryClient.setQueryData(primaryKey, ['primary'])
    queryClient.setQueryData(secondaryKey, ['secondary'])

    let primaryListener: ((change: SessionChange) => void) | undefined
    let secondaryListener: ((change: SessionChange) => void) | undefined
    const primaryOff = vi.fn()
    const secondaryOff = vi.fn()
    const primaryStart = vi.fn()
    const secondaryStart = vi.fn()
    const primaryOnChange = vi.fn((listener: (change: SessionChange) => void) => {
      primaryListener = listener
      return primaryOff
    })
    const secondaryOnChange = vi.fn((listener: (change: SessionChange) => void) => {
      secondaryListener = listener
      return secondaryOff
    })

    const unsubscribe = subscribeTasksSessions(
      [
        {
          connectionId: null,
          environmentId: null,
          session: { start: primaryStart, onChange: primaryOnChange },
        },
        {
          connectionId: 'connection-secondary',
          environmentId: SECONDARY_ENVIRONMENT,
          session: { start: secondaryStart, onChange: secondaryOnChange },
        },
      ],
      { queryClient, host: PRIMARY_DAEMON.host, version: PRIMARY_DAEMON.version },
    )

    expect(primaryStart).toHaveBeenCalledOnce()
    expect(secondaryStart).toHaveBeenCalledOnce()
    secondaryListener?.({ kind: 'tasks.changed' })
    expect(queryClient.getQueryState(secondaryKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(primaryKey)?.isInvalidated).toBeFalsy()
    primaryListener?.({ kind: 'tasks.changed' })
    expect(queryClient.getQueryState(primaryKey)?.isInvalidated).toBe(true)

    unsubscribe()
    expect(primaryOff).toHaveBeenCalledOnce()
    expect(secondaryOff).toHaveBeenCalledOnce()
  })
})
