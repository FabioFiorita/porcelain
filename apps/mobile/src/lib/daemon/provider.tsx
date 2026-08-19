import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
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
import {
  activeEnvironment,
  activeProjectPathOf,
  environmentActions,
  goUnauthorized,
  isPaired,
  recoverToPreferredEndpoint,
  retryConnection,
  subscribeToEnvironments,
  useActiveEnvironment,
  useConnectionState,
} from '@/features/remote'
import { DaemonError } from './errors'
import { daemonKeys } from './queries'
import {
  configureSession,
  onSessionClosed,
  setSessionForeground,
  subscribeSessionChanges,
} from './session'

/**
 * Map one change notification to the procedure names it makes stale — the domains that still
 * key their cache by procedure name. Invalidating an absent key is a no-op.
 *
 * The exhaustive switch is deliberate: a category added to the contract fails the annotated
 * return type at typecheck unless this switch gains a branch — so a new domain signal cannot
 * silently ship un-refreshed.
 */
export function proceduresForChange(change: SessionChange): readonly string[] {
  switch (change.kind) {
    case 'git.working-tree-changed':
      // Git identities are typed and owned by GitNotificationBridge; nothing here to refresh.
      return []
    case 'files.scope-changed':
      // Files identities are owned by FilesNotificationBridge; keep provider recovery for
      // cross-domain procedure identities only.
      return []
    case 'files.tree-changed':
      return []
    case 'files.content-changed':
      // Files content/tree identities belong to the typed Files notification bridge, and the
      // diff reading it also moves is a typed Git identity now.
      return []
    case 'actions.changed':
      // ActionsNotificationBridge owns exact Actions list invalidation (ACT-003).
      return []
    case 'tasks.changed':
      // Tasks has no mobile client yet (its registry entry lists three target roots);
      // when one lands it owns its own typed identities, as every other domain does.
      return []
    case 'terminal.worktree-script-started':
    case 'terminal.dev-servers-changed':
      // Mobile does not surface development servers or Worktree lifecycle terminals yet; the
      // Hub client owns those. Listed so the switch stays exhaustive rather than silently
      // dropping a new signal.
      return []
    case 'review.changed':
      // Mobile comments are stubbed; the Hub client owns review comments and marks.
      return []
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
    ) as SessionChange
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
    if (!isPaired(activeEnvironment())) return
    settleBackground(retryConnection(), 'lifecycle')
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
      if (isPaired(current)) await retryConnection()
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
      if (isPaired(current)) await retryConnection()
    }
    settleBackground(run(), 'lifecycle')
  }, [identity])

  useEffect(() => {
    // Lazy by contract: the socket opens once a repo is open, not merely because a daemon is paired.
    if (environmentId === null || projectPath === null) return
    return subscribeSessionChanges({
      onChange: (change) => {
        invalidateProcedures(environmentId, proceduresForChange(change))
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
