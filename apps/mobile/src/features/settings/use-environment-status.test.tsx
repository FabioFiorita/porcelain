import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import type { Environment } from '@/features/remote'

vi.mock('@/features/remote', async () => import('@/features/remote/remote-environment'))
vi.mock('@/lib/daemon/client', () => ({ getDaemonClient: (env: Environment) => env }))
vi.mock('@/lib/daemon/queries', () => ({
  daemonKeys: { call: (id: string, name: string) => ['daemon', id, name] },
}))
vi.mock('@/lib/daemon/procedure', () => ({
  namedContractQuery: (name: string) => ({ name }),
  callDaemon: async (env: Environment) => {
    if (env.id === 'offline') throw new Error('unreachable')
    return { version: env.id === 'first' ? '1.0.0' : '2.0.0' }
  },
}))

import { useEnvironmentStatus } from './use-environment-status'

function environment(id: string): Environment {
  return {
    id,
    nickname: id,
    enabled: true,
    token: 'test',
    baseUrl: 'http://localhost:43118',
    endpoints: ['http://localhost:43118'],
    preferredEndpoint: 'http://localhost:43118',
    createdAt: 0,
    activeRepoPath: null,
    icon: 'desktop',
  }
}

it('reports simultaneous connections independently, including an unreachable environment', async () => {
  const client = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const view = renderHook(
    () => ({
      first: useEnvironmentStatus(environment('first')),
      second: useEnvironmentStatus(environment('second')),
      offline: useEnvironmentStatus(environment('offline')),
      disabled: useEnvironmentStatus({ ...environment('disabled'), enabled: false }),
    }),
    { wrapper },
  )
  await waitFor(() => {
    expect(view.result.current.first).toEqual({ label: 'Connected', version: '1.0.0' })
    expect(view.result.current.second).toEqual({ label: 'Connected', version: '2.0.0' })
    expect(view.result.current.offline.label).toBe('Connection failed')
    expect(view.result.current.disabled.label).toBe('Disconnected')
  })
  view.unmount()
  client.clear()
})
