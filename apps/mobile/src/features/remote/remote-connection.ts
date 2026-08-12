import { orderRemoteEndpoints } from '@porcelain/client-runtime/remote'
import { type EndpointKind, endpointKind } from '@porcelain/contracts'

import type { Environment, EnvironmentId } from './remote-environment'
import { environmentsStore } from './remote-environment-store'

export type EndpointAttempt = { url: string; kind: EndpointKind }
type Reachability = {
  state: 'reachable' | 'unreachable'
  source: 'endpoint-walk' | 'query'
  consecutiveFailures: number
  attempted: readonly EndpointAttempt[]
}

export type ConnectionState =
  | { kind: 'loading' }
  | { kind: 'no-environment' }
  | { kind: 'connecting' }
  | { kind: 'ready'; daemonVersion: string; reachability: Reachability }
  | { kind: 'unreachable'; message: string; reachability: Reachability }
  | { kind: 'unauthorized'; cleanupError?: string } // cleanupError: secure-store delete failed after memory clear
  | { kind: 'update-required' }

export const REACHABILITY_FAILURE_THRESHOLD = 2

export function useConnectionState(): ConnectionState {
  return environmentsStore((state) => state.connection)
}

export function currentConnection(): ConnectionState {
  return environmentsStore.getState().connection
}

export function connectionFor(environment: Environment | null): ConnectionState {
  if (environment === null) return { kind: 'no-environment' }
  return environment.token === null ? { kind: 'unauthorized' } : { kind: 'connecting' }
}

export function recordReachabilityFailure(
  id: EnvironmentId,
  message: string,
  attempted?: readonly EndpointAttempt[],
): void {
  const state = environmentsStore.getState()
  if (state.activeId !== id) return
  const environment = state.environments.find((candidate) => candidate.id === id)
  if (environment === undefined || environment.token === null) return
  const routes =
    attempted ??
    orderRemoteEndpoints({
      endpoints: environment.endpoints,
      preferredEndpoint: environment.preferredEndpoint,
      url: environment.baseUrl,
    }).map((url) => ({ kind: endpointKind(url), url }))
  const previousFailures =
    state.connection.kind === 'ready' || state.connection.kind === 'unreachable'
      ? state.connection.reachability.consecutiveFailures
      : 0
  const consecutiveFailures = previousFailures + 1
  if (consecutiveFailures < REACHABILITY_FAILURE_THRESHOLD) {
    if (state.connection.kind !== 'ready') return
    environmentsStore.setState({
      connection: {
        ...state.connection,
        reachability: {
          attempted: routes,
          consecutiveFailures,
          source: 'query',
          state: 'reachable',
        },
      },
    })
    return
  }
  environmentsStore.setState({
    connection: {
      kind: 'unreachable',
      message,
      reachability: {
        attempted: routes,
        consecutiveFailures,
        source: 'query',
        state: 'unreachable',
      },
    },
  })
}

export function recordReachabilitySuccess(id: EnvironmentId): void {
  const state = environmentsStore.getState()
  if (state.activeId !== id) return
  if (state.connection.kind === 'ready') {
    environmentsStore.setState({
      connection: {
        ...state.connection,
        reachability: {
          ...state.connection.reachability,
          consecutiveFailures: 0,
          source: 'endpoint-walk',
          state: 'reachable',
        },
      },
    })
  }
}

export function setConnection(connection: ConnectionState): void {
  environmentsStore.setState({ connection })
}
