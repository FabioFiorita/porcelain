import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { STUDIO_ID } from './test-support'

const ctx = vi.hoisted(() => ({
  active: { id: 'env-studio' } as { id: string } | null,
  observer: null as {
    onChange: (change: { kind: string }) => void
    onFreshnessRequired: (requirement: unknown) => void
  } | null,
  unsubscribe: vi.fn(),
}))

vi.mock('@/features/remote', () => ({ useActiveEnvironment: () => ctx.active }))
vi.mock('@/lib/daemon/session', () => ({
  subscribeSessionChanges: (observer: {
    onChange: (change: { kind: string }) => void
    onFreshnessRequired: (requirement: unknown) => void
  }) => {
    ctx.observer = observer
    return ctx.unsubscribe
  },
}))

import { TasksNotificationBridge } from './tasks-notification-bridge'
import { tasksTableKey } from './tasks-query-key'

function mount(queryClient: QueryClient): { unmount: () => void } {
  function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return render(<TasksNotificationBridge />, { wrapper: Wrapper })
}

beforeEach(() => {
  ctx.active = { id: STUDIO_ID }
  ctx.observer = null
  ctx.unsubscribe.mockReset()
})

describe('TasksNotificationBridge', () => {
  it('refreshes the active Environment’s table when the daemon says it changed', async () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    mount(queryClient)

    ctx.observer?.onChange({ kind: 'tasks.changed' })
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalled())

    expect(invalidate).toHaveBeenCalledWith({ queryKey: tasksTableKey(STUDIO_ID), exact: true })
  })

  it('ignores every other domain’s notifications', () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    mount(queryClient)

    ctx.observer?.onChange({ kind: 'actions.changed' })

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('does not subscribe before an Environment is active, and releases on unmount', () => {
    ctx.active = null
    const unmountedEarly = mount(new QueryClient())
    expect(ctx.observer).toBeNull()
    unmountedEarly.unmount()

    ctx.active = { id: STUDIO_ID }
    const mounted = mount(new QueryClient())
    expect(ctx.observer).not.toBeNull()
    mounted.unmount()
    expect(ctx.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
