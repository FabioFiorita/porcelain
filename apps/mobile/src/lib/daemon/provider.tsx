import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import { endpointKind, orderedEndpointUrls } from '@porcelain/contracts'
import type { SessionChange } from '@porcelain/contracts/session'
import { settleBackground } from '@porcelain/shared/background'
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import * as Network from 'expo-network'
import { type ReactNode, useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { openProjectProcedure, recentProjectsProcedure } from '@/features/projects'
import { createDaemonClient, PROBE_TIMEOUT_MS } from './client'
import { activeProjectPathOf, isPaired, type PairedEnvironment } from './environment'
import {
  activeEnvironment,
  currentConnection,
  type EndpointAttempt,
  environmentActions,
  subscribeToEnvironments,
  useActiveEnvironment,
  useConnectionState,
} from './environments-store'
import { DaemonError, daemonErrorMessage } from './errors'
import { goUnauthorized } from './go-unauthorized'
import { callDaemon } from './procedure'
import { daemonInfoQuery } from './procedures/connection'
import { daemonKeys } from './queries'
import {
  configureSession,
  onSessionClosed,
  setSessionForeground,
  subscribeSessionChanges,
} from './session'

/**
 * Map one change notification to the procedure names it makes stale. The union of today's
 * legacy `APP_EVENT_INVALIDATIONS` entries where the target contract merges several events into
 * one category (review, working-tree split into files/git). Invalidating an absent key is a
 * no-op.
 *
 * The `default` fall-through is deliberate: a category added to the contract fails the annotated
 * return type at typecheck unless this switch gains a branch — so a new domain signal cannot
 * silently ship un-refreshed.
 */
type GlobalSessionChange = Exclude<SessionChange, { kind: 'git.working-tree-changed' }>

export function proceduresForChange(change: GlobalSessionChange): readonly string[] {
  switch (change.kind) {
    case 'files.scope-changed':
      // Files identities are owned by FilesNotificationBridge; keep provider recovery for
      // cross-domain procedure identities only.
      return []
    case 'files.tree-changed':
      return []
    case 'files.content-changed':
      // Diff reading is still provider-owned; Files content/tree identities belong to the
      // typed Files notification bridge.
      return ['diffReading']
    case 'review.changed':
      // union of feature-view, layers, evidence — comments owned by
      // ReviewCommentNotificationBridge (RVC-004)
      return [
        'featureView',
        'featureReading',
        'worktreeInbox',
        'repoLayers',
        'loopEvidence',
        'loopEvidenceHtml',
        'reviewEvidenceDocs',
        'reviewEvidenceAssets',
        'reviewEvidenceAsset',
        'gitFlow',
        'gitRangeFlow',
        'gitCommitFlow',
      ]
    case 'board.changed':
      // BoardNotificationBridge owns exact Board cards invalidation (BRD-005).
      return []
    case 'actions.changed':
      return ['actions']
  }
}

/**
 * Recover from a freshness requirement the runtime raised.
 * - `session` scope (reconnect / replaced daemon): invalidate every daemon-derived query.
 * - `project` scope (sequence gap): invalidate provider-owned project procedures; typed domain
 *   bridges recover their own identities from the requirement's project path.
 */
export function proceduresForRecovery(
  requirement: FreshnessRequirement,
): 'all' | readonly string[] {
  if (requirement.scope.kind === 'session') return 'all'
  // Narrower than the whole client, still wholesale: a gap says only that something was missed.
  const kinds: SessionChange['kind'][] = [
    'files.scope-changed',
    'files.tree-changed',
    'files.content-changed',
    'review.changed',
    'board.changed',
    'actions.changed',
  ]
  const names = new Set<string>()
  for (const kind of kinds) {
    const change = (
      kind === 'files.tree-changed' || kind === 'files.content-changed'
        ? {
            kind,
            projectPath: requirement.scope.projectPath,
            paths: [requirement.scope.projectPath],
          }
        : { kind, projectPath: requirement.scope.projectPath }
    ) as GlobalSessionChange
    for (const name of proceduresForChange(change)) names.add(name)
  }
  return [...names]
}

function invalidateProcedures(environmentId: string, names: readonly string[]): void {
  for (const name of names) {
    settleBackground(
      queryClient.invalidateQueries({ queryKey: daemonKeys.procedure(environmentId, name) }),
      'invalidation',
    )
  }
}

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
    const online = state.isConnected ?? true
    setOnline(online)
    // Recovery owns connection state transitions (ready/unreachable); silent settle is intentional.
    if (online) settleBackground(recoverToPreferredEndpoint(), 'lifecycle')
  })
  return (): void => {
    subscription.remove()
  }
})

async function bootstrapAtEndpoint(
  environment: PairedEnvironment,
  baseUrl: string,
): Promise<{ daemonVersion: string }> {
  // Short-fused on purpose: this is the reachability probe, not the client this endpoint's
  // regular traffic uses once it wins the walk — see `PROBE_TIMEOUT_MS` in `client.ts`.
  const client = createDaemonClient(baseUrl, environment.token, { timeoutMs: PROBE_TIMEOUT_MS })
  const daemonVersion = (await callDaemon(client, daemonInfoQuery, undefined)).version

  // Doubles as the token probe: a 401 here is what proves the credential is dead.
  await callDaemon(client, recentProjectsProcedure, { includeWorktrees: true })

  const projectPath = activeProjectPathOf(environment)
  if (projectPath !== null) {
    try {
      await callDaemon(client, openProjectProcedure, projectPath)
    } catch (error) {
      // A repo deleted or moved on the host is not a broken daemon: forget the choice and
      // let the repo gate ask for a new one, rather than showing an unretryable failure.
      if (
        error instanceof DaemonError &&
        (error.kind === 'unauthorized' || error.kind === 'unreachable')
      ) {
        throw error
      }
      await environmentActions.setActiveProjectPath(environment.id, null)
    }
  }
  return { daemonVersion }
}

class EndpointWalkError extends Error {
  readonly attempts: readonly EndpointAttempt[]
  readonly firstError: DaemonError

  constructor(attempts: readonly EndpointAttempt[], firstError: DaemonError) {
    super('No endpoint in this environment group answered.')
    this.name = 'EndpointWalkError'
    this.attempts = attempts
    this.firstError = firstError
  }
}

/** Probe routes in the group's explicit order; a working LAN route wins over a slower fallback. */
async function bootstrap(
  environment: PairedEnvironment,
): Promise<{ daemonVersion: string; attempts: readonly EndpointAttempt[] }> {
  let firstUnreachable: DaemonError | null = null
  const attempts: EndpointAttempt[] = []
  const endpoints = orderedEndpointUrls({
    endpoints: environment.endpoints,
    preferredEndpoint: environment.preferredEndpoint,
    url: environment.baseUrl,
  })

  for (const baseUrl of endpoints) {
    attempts.push({ kind: endpointKind(baseUrl), url: baseUrl })
    try {
      const ready = await bootstrapAtEndpoint(environment, baseUrl)
      if (baseUrl !== environment.baseUrl) {
        await environmentActions.setActiveEndpoint(environment.id, baseUrl)
      }
      return { ...ready, attempts }
    } catch (error) {
      if (error instanceof DaemonError && error.kind === 'unauthorized') throw error
      if (!(error instanceof DaemonError && error.kind === 'unreachable')) throw error
      firstUnreachable ??= error
    }
  }

  throw new EndpointWalkError(
    attempts,
    firstUnreachable ??
      new DaemonError('unreachable', 'bootstrap', 'The daemon could not be reached.'),
  )
}

async function connect(environment: PairedEnvironment): Promise<void> {
  const previous = currentConnection()
  environmentActions.setConnection({ kind: 'connecting' })
  try {
    const ready = await bootstrap(environment)
    environmentActions.setConnection({
      daemonVersion: ready.daemonVersion,
      kind: 'ready',
      reachability: {
        attempted: ready.attempts,
        consecutiveFailures: 0,
        source: 'endpoint-walk',
        state: 'reachable',
      },
    })
  } catch (error) {
    if (error instanceof DaemonError && error.kind === 'unauthorized') {
      await goUnauthorized(environment)
      return
    }
    const walk = error instanceof EndpointWalkError ? error : null
    const current = previous
    const previousFailures =
      current.kind === 'unreachable' ? current.reachability.consecutiveFailures : 0
    const daemonError =
      walk?.firstError ??
      new DaemonError('unreachable', 'bootstrap', 'The daemon could not be reached.')
    environmentActions.setConnection({
      kind: 'unreachable',
      message: daemonErrorMessage(daemonError),
      reachability: {
        attempted: walk?.attempts ?? [
          { kind: endpointKind(environment.baseUrl), url: environment.baseUrl },
        ],
        consecutiveFailures: previousFailures + 1,
        source: 'endpoint-walk',
        state: 'unreachable',
      },
    })
  }
}

/** Re-run the bootstrap sequence against the active environment — the gate's Retry. */
export async function retryConnection(): Promise<void> {
  const current = activeEnvironment()
  if (isPaired(current)) await connect(current)
}

/**
 * Climb back to the preferred route once it might be reachable again — `bootstrap` always tries
 * `preferredEndpoint` first, so replaying it is the whole mechanism. Only worth it once we've
 * actually settled on a fallback (nothing to climb back from otherwise) and only while healthy: a
 * connection already mid-failure has its own walk in flight from `recordReachabilityFailure`.
 */
export async function recoverToPreferredEndpoint(): Promise<void> {
  const current = activeEnvironment()
  if (!isPaired(current)) return
  if (current.baseUrl === current.preferredEndpoint) return
  if (currentConnection().kind !== 'ready') return
  await connect(current)
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
  const projectPath = activeProjectPathOf(environment)
  const connection = useConnectionState()
  const identity =
    environment === null
      ? null
      : `${environment.id}:${token}:${environment.preferredEndpoint}:${environment.endpoints.join('|')}`

  useEffect(() => {
    if (connection.kind !== 'unreachable' || connection.reachability.source !== 'query') return
    const current = activeEnvironment()
    if (!isPaired(current)) return
    const recover = async (): Promise<void> => {
      await connect(current)
    }
    settleBackground(recover(), 'lifecycle')
  }, [connection])

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
    onSessionClosed(async (reason) => {
      const current = activeEnvironment()
      if (current === null) return
      if (reason === 'revoked') {
        await goUnauthorized(current)
        return
      }
      if (isPaired(current)) await connect(current)
    })
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      setSessionForeground(state === 'active')
      if (state === 'active') settleBackground(recoverToPreferredEndpoint(), 'lifecycle')
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
    // hydrate() maps store read failure to no-environment itself.
    settleBackground(hydrate(), 'lifecycle')
  }, [])

  useEffect(() => {
    if (baseUrl === null || token === null) {
      configureSession(null)
      return
    }
    configureSession({ baseUrl, repo: projectPath, token })
  }, [baseUrl, token, projectPath])

  // Keyed on the daemon's identity, not the environment object: `openProject` already ran
  // `openRepoPath`, so re-bootstrapping on a repo change would run the sequence twice.
  useEffect(() => {
    if (identity === null) return
    const run = async (): Promise<void> => {
      const current = activeEnvironment()
      if (isPaired(current)) await connect(current)
    }
    settleBackground(run(), 'lifecycle')
  }, [identity])

  useEffect(() => {
    // Lazy by contract: the socket opens once a repo is open, not merely because a daemon is paired.
    if (environmentId === null || projectPath === null) return
    return subscribeSessionChanges({
      onChange: (change) => {
        if (change.kind !== 'git.working-tree-changed') {
          invalidateProcedures(environmentId, proceduresForChange(change))
        }
      },
      onFreshnessRequired: (requirement) => {
        const target = proceduresForRecovery(requirement)
        if (target === 'all') {
          settleBackground(
            queryClient.invalidateQueries({ queryKey: daemonKeys.environment(environmentId) }),
            'invalidation',
          )
          return
        }
        invalidateProcedures(environmentId, target)
      },
    })
  }, [environmentId, projectPath])

  return null
}
