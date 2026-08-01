import { orderedEndpointUrls } from '@porcelain/contracts'
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import * as Network from 'expo-network'
import { type ReactNode, useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { APP_EVENT_INVALIDATIONS } from './app-events'
import { createDaemonClient, getDaemonClient } from './client'
import { type Environment, isPaired, type PairedEnvironment } from './environment'
import {
  activeEnvironment,
  type ConnectionState,
  environmentActions,
  subscribeToEnvironments,
  useActiveEnvironment,
} from './environments-store'
import { DaemonError } from './errors'
import { callDaemon } from './procedure'
import { daemonInfoQuery, openRepoPathMutation, recentReposQuery } from './procedures/connection'
import { daemonKeys } from './queries'
import { configureSession, daemonSession, onSessionClosed, setSessionForeground } from './session'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 5 * 60_000,
      refetchOnMount: true,
      refetchOnReconnect: true,
      // Only a host that might come back is worth retrying: a revoked token, a procedure this
      // daemon lacks, and a payload we cannot parse all fail the same way three times over.
      retry: (failureCount: number, error: Error): boolean =>
        error instanceof DaemonError && error.kind === 'unreachable' && failureCount < 2,
      staleTime: 5_000,
    },
  },
})

focusManager.setEventListener((setFocused): (() => void) => {
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    setFocused(state === 'active')
  })
  return (): void => {
    subscription.remove()
  }
})

// `isConnected`, not `isInternetReachable`: a daemon on the LAN or a tailnet is reachable
// from a phone with no route to the internet at all.
onlineManager.setEventListener((setOnline): (() => void) => {
  const subscription = Network.addNetworkStateListener((state: Network.NetworkState) => {
    setOnline(state.isConnected ?? true)
  })
  return (): void => {
    subscription.remove()
  }
})

async function bootstrapAtEndpoint(
  environment: PairedEnvironment,
  baseUrl: string,
): Promise<ConnectionState> {
  const client = createDaemonClient(baseUrl, environment.token)
  let daemonVersion: string | null = null
  try {
    daemonVersion = (await callDaemon(client, daemonInfoQuery, undefined)).version
  } catch (error) {
    // A daemon older than 0.30 has no `daemonInfo` at all — that is skew, not a failure.
    if (!(error instanceof DaemonError) || error.kind !== 'unsupported') throw error
  }

  // Doubles as the token probe: a 401 here is what proves the credential is dead.
  await callDaemon(client, recentReposQuery, { includeWorktrees: true })

  if (environment.activeRepoPath !== null) {
    try {
      await callDaemon(client, openRepoPathMutation, environment.activeRepoPath)
    } catch (error) {
      // A repo deleted or moved on the host is not a broken daemon: forget the choice and
      // let the repo gate ask for a new one, rather than showing an unretryable failure.
      if (
        error instanceof DaemonError &&
        (error.kind === 'unauthorized' || error.kind === 'unreachable')
      ) {
        throw error
      }
      await environmentActions.setActiveRepoPath(environment.id, null)
    }
  }
  return { daemonVersion, kind: 'ready' }
}

/** Probe routes in the group's explicit order; a working LAN route wins over a slower fallback. */
async function bootstrap(environment: PairedEnvironment): Promise<ConnectionState> {
  let firstUnreachable: Error | null = null
  const endpoints = orderedEndpointUrls({
    endpoints: environment.endpoints,
    preferredKind: environment.preferredKind,
    url: environment.baseUrl,
  })

  for (const baseUrl of endpoints) {
    try {
      const ready = await bootstrapAtEndpoint(environment, baseUrl)
      if (baseUrl !== environment.baseUrl) {
        await environmentActions.setActiveEndpoint(environment.id, baseUrl)
      }
      return ready
    } catch (error) {
      if (error instanceof DaemonError && error.kind === 'unauthorized') throw error
      const normalized =
        error instanceof Error ? error : new Error('The daemon could not be reached.')
      firstUnreachable ??= normalized
      if (!(error instanceof DaemonError && error.kind === 'unreachable')) throw error
    }
  }

  throw firstUnreachable ?? new Error('The daemon could not be reached.')
}

/** The credential is dead: drop it, stop the socket, and keep the daemon's name for re-pairing. */
async function goUnauthorized(environment: Environment): Promise<void> {
  configureSession(null)
  await environmentActions.forgetToken(environment.id)
  environmentActions.setConnection({ kind: 'unauthorized' })
}

async function connect(environment: PairedEnvironment): Promise<void> {
  environmentActions.setConnection({ kind: 'connecting' })
  try {
    environmentActions.setConnection(await bootstrap(environment))
  } catch (error) {
    if (error instanceof DaemonError && error.kind === 'unauthorized') {
      await goUnauthorized(environment)
      return
    }
    const message = error instanceof Error ? error.message : 'The daemon could not be reached.'
    environmentActions.setConnection({ kind: 'unreachable', message })
  }
}

/**
 * A refused upgrade looks the same as a dead host, so ask over HTTP: only a 401 is a verdict.
 * Anything else leaves the socket's own backoff to keep trying.
 */
async function probeAuthorization(): Promise<void> {
  const current = activeEnvironment()
  if (!isPaired(current)) return
  try {
    await callDaemon(getDaemonClient(current), recentReposQuery, { includeWorktrees: true })
  } catch (error) {
    if (error instanceof DaemonError && error.kind === 'unauthorized') await goUnauthorized(current)
  }
}

/** Re-run the bootstrap sequence against the active environment — the gate's Retry. */
export async function retryConnection(): Promise<void> {
  const current = activeEnvironment()
  if (isPaired(current)) await connect(current)
}

/**
 * The one wiring point: hydration, the bootstrap sequence, the socket lifecycle, and React
 * Query's focus/online managers. It renders children immediately — hydration is exposed
 * through `useConnectionState`, so a cold start on a dead daemon still lands in a usable shell.
 */
export function DaemonProvider({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <DaemonLifecycle />
      {children}
    </QueryClientProvider>
  )
}

function DaemonLifecycle(): null {
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? null
  const baseUrl = environment?.baseUrl ?? null
  const token = environment?.token ?? null
  const repoPath = environment?.activeRepoPath ?? null
  const identity =
    environment === null
      ? null
      : `${environment.id}:${token}:${environment.preferredKind ?? ''}:${environment.endpoints.join('|')}`

  useEffect(() => {
    // An unpaired daemon's cache is not just stale, it is another machine's — drop it whole.
    const known = new Set<string>()
    const off = subscribeToEnvironments((state) => {
      const live = new Set(state.environments.map((candidate) => candidate.id))
      for (const id of known) {
        if (!live.has(id)) queryClient.removeQueries({ queryKey: daemonKeys.environment(id) })
      }
      known.clear()
      for (const id of live) known.add(id)
    })
    onSessionClosed((reason) => {
      const current = activeEnvironment()
      if (current === null) return
      const settle = async (): Promise<void> => {
        if (reason === 'revoked') await goUnauthorized(current)
        else await probeAuthorization()
      }
      settle()
    })
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      setSessionForeground(state === 'active')
    })
    return () => {
      off()
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    const hydrate = async (): Promise<void> => {
      try {
        await environmentActions.hydrate()
      } catch {
        environmentActions.setConnection({ kind: 'no-environment' })
      }
    }
    hydrate()
  }, [])

  useEffect(() => {
    if (baseUrl === null || token === null) {
      configureSession(null)
      return
    }
    configureSession({ baseUrl, repo: repoPath, token })
  }, [baseUrl, token, repoPath])

  // Keyed on the daemon's identity, not the environment object: `openRepo` already ran
  // `openRepoPath`, so re-bootstrapping on a repo change would run the sequence twice.
  useEffect(() => {
    if (identity === null) return
    const run = async (): Promise<void> => {
      const current = activeEnvironment()
      if (isPaired(current)) await connect(current)
    }
    run()
  }, [identity])

  useEffect(() => {
    // Lazy by contract: the socket opens once a repo is open, not merely because a daemon is paired.
    if (environmentId === null || repoPath === null) return
    return daemonSession.subscribe((frame) => {
      if (frame.t !== 'app-event') return
      for (const name of APP_EVENT_INVALIDATIONS[frame.event]) {
        queryClient.invalidateQueries({ queryKey: daemonKeys.procedure(environmentId, name) })
      }
    })
  }, [environmentId, repoPath])

  return null
}
