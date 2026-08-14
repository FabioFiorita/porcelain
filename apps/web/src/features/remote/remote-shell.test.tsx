import type { ShellRouter } from '@main/shell-api'
import type { EndpointKind } from '@porcelain/contracts'
import { shellTrpc } from '@renderer/lib/trpc'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { Operation, OperationResultObservable, TRPCLink } from '@trpc/client'
import { TRPCClientError } from '@trpc/client'
import { observable } from '@trpc/server/observable'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type EnvironmentEndpoint,
  useConnectRemoteEnvironment,
  useDisconnectRemoteEnvironment,
  useEnvironmentStatuses,
  usePairEnvironmentConnection,
  useRemoteEnvironments,
} from './remote-shell'

const platform = vi.hoisted(() => ({ isBrowser: true }))

vi.mock('@renderer/lib/platform', () => platform)

const LAN = 'http://192.168.1.50:43117'

type ShellHandle = (op: Operation) => Promise<unknown>

function stubLink(handle: ShellHandle): TRPCLink<ShellRouter> {
  return () =>
    ({ op }: { op: Operation }): OperationResultObservable<ShellRouter, unknown> =>
      observable((observer) => {
        handle(op).then(
          (data) => {
            observer.next({ result: { data } })
            observer.complete()
          },
          (error: unknown) => {
            observer.error(
              error instanceof TRPCClientError
                ? error
                : new TRPCClientError(error instanceof Error ? error.message : String(error)),
            )
          },
        )
      })
}

function shellWrapper(
  handle: ShellHandle,
): (props: { children: React.ReactNode }) => React.JSX.Element {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const client = shellTrpc.createClient({ links: [stubLink(handle)] })
  return ({ children }: { children: React.ReactNode }): React.JSX.Element => (
    <shellTrpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </shellTrpc.Provider>
  )
}

const emptyEnvironments = {
  activeId: null,
  defaultId: null,
  environments: [] as const,
}

beforeEach(() => {
  platform.isBrowser = true
})

describe('remote shell Electron gate', () => {
  it('disables environment and status queries in the browser', async () => {
    const requests: string[] = []
    const wrapper = shellWrapper(async (op) => {
      requests.push(op.path)
      if (op.path === 'remoteEnvironments') return emptyEnvironments
      if (op.path === 'environmentStatuses') return []
      return undefined
    })

    renderHook(
      () => ({
        environments: useRemoteEnvironments(),
        statuses: useEnvironmentStatuses(),
      }),
      { wrapper },
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(requests).toEqual([])
  })
})

describe('remote shell pairing invalidation', () => {
  beforeEach(() => {
    platform.isBrowser = false
  })

  it('invalidates list and statuses when pairing stays put', async () => {
    const requests: string[] = []
    const wrapper = shellWrapper(async (op) => {
      requests.push(`${op.type}:${op.path}`)
      if (op.path === 'remoteEnvironments') return emptyEnvironments
      if (op.path === 'environmentStatuses') return []
      if (op.path === 'pairEnvironmentConnection') {
        return { id: 'beelink', reloaded: false, merged: false }
      }
      return undefined
    })

    const { result } = renderHook(
      () => ({
        environments: useRemoteEnvironments(),
        statuses: useEnvironmentStatuses(),
        pair: usePairEnvironmentConnection(),
      }),
      { wrapper },
    )

    await waitFor(() =>
      expect(requests.filter((path) => path.startsWith('query:'))).toHaveLength(2),
    )

    await act(async () => {
      result.current.pair.pair({ connectionLink: 'https://beelink.example.ts.net/pair#token=x' })
    })
    await waitFor(() =>
      expect(requests.filter((path) => path === 'query:remoteEnvironments')).toHaveLength(2),
    )
    expect(requests.filter((path) => path === 'query:environmentStatuses')).toHaveLength(2)
    expect(requests).toContain('mutation:pairEnvironmentConnection')
  })

  it('does not invalidate when pairing reloads the window', async () => {
    const requests: string[] = []
    const wrapper = shellWrapper(async (op) => {
      requests.push(`${op.type}:${op.path}`)
      if (op.path === 'remoteEnvironments') return emptyEnvironments
      if (op.path === 'environmentStatuses') return []
      if (op.path === 'pairEnvironmentConnection') {
        return { id: 'beelink', reloaded: true, merged: false }
      }
      return undefined
    })

    const { result } = renderHook(
      () => ({
        environments: useRemoteEnvironments(),
        statuses: useEnvironmentStatuses(),
        pair: usePairEnvironmentConnection(),
      }),
      { wrapper },
    )

    await waitFor(() =>
      expect(requests.filter((path) => path.startsWith('query:'))).toHaveLength(2),
    )

    await act(async () => {
      result.current.pair.pair({ connectionLink: 'https://beelink.example.ts.net/pair#token=x' })
    })
    await waitFor(() => expect(requests).toContain('mutation:pairEnvironmentConnection'))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(requests.filter((path) => path === 'query:remoteEnvironments')).toHaveLength(1)
    expect(requests.filter((path) => path === 'query:environmentStatuses')).toHaveLength(1)
  })

  it('does not invalidate on connect or disconnect', async () => {
    const requests: string[] = []
    const wrapper = shellWrapper(async (op) => {
      requests.push(`${op.type}:${op.path}`)
      if (op.path === 'remoteEnvironments') return emptyEnvironments
      if (op.path === 'environmentStatuses') return []
      return undefined
    })

    const { result } = renderHook(
      () => ({
        environments: useRemoteEnvironments(),
        statuses: useEnvironmentStatuses(),
        connect: useConnectRemoteEnvironment(),
        disconnect: useDisconnectRemoteEnvironment(),
      }),
      { wrapper },
    )

    await waitFor(() =>
      expect(requests.filter((path) => path.startsWith('query:'))).toHaveLength(2),
    )

    await act(async () => {
      result.current.connect.connect('beelink')
    })
    await act(async () => {
      result.current.disconnect.disconnect()
    })
    await waitFor(() => {
      expect(requests).toContain('mutation:connectRemoteEnvironment')
      expect(requests).toContain('mutation:disconnectRemoteEnvironment')
    })
    expect(requests.filter((path) => path === 'query:remoteEnvironments')).toHaveLength(1)
    expect(requests.filter((path) => path === 'query:environmentStatuses')).toHaveLength(1)
  })
})

describe('EnvironmentEndpoint kind', () => {
  it('uses EndpointKind from contracts, not main remote-daemon', () => {
    const kind: EndpointKind = 'lan'
    const endpoint: EnvironmentEndpoint = {
      url: LAN,
      kind,
      preferred: true,
    }
    expect(endpoint.kind).toBe('lan')
  })
})
