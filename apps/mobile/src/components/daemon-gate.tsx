import type { EndpointKind } from '@porcelain/contracts'
import { router } from 'expo-router'
import type { ReactNode } from 'react'

import { EmptyState } from '@/components/empty-state'
import {
  useActiveEnvironment,
  useConnectionState,
  useEnvironmentsCorrupt,
} from '@/lib/daemon/environments-store'
import { retryConnection } from '@/lib/daemon/provider'
import { useActiveRepo } from '@/lib/daemon/repo'

function endpointLabel(kind: EndpointKind): string {
  switch (kind) {
    case 'lan':
      return 'LAN'
    case 'tailnet':
      return 'Tailscale'
    case 'other':
      return 'Funnel / Internet'
  }
}

function attemptedRoutes(kinds: readonly EndpointKind[]): string {
  const counts = new Map<string, number>()
  for (const kind of kinds) {
    const label = endpointLabel(kind)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const routes = [...counts].map(([label, count]) =>
    count === 1 ? label : `${count} ${label} connections`,
  )
  if (routes.length === 0) return ''
  if (routes.length === 1) return `Tried ${routes[0]}.`
  return `Tried ${routes.slice(0, -1).join(', ')} and ${routes.at(-1)}.`
}

/**
 * The whole contract for empty and locked states: a tab wraps its content in this and writes
 * none of its own. `loading` and `connecting` render children — a query shows its own pending
 * state, and a spinner over the whole tab is a worse answer than a stale one.
 */
export function DaemonGate({
  children,
  requires,
}: {
  requires: 'environment' | 'repo'
  children: ReactNode
}): React.JSX.Element {
  const connection = useConnectionState()
  const environment = useActiveEnvironment()
  const repo = useActiveRepo()
  const corrupt = useEnvironmentsCorrupt()

  switch (connection.kind) {
    case 'no-environment':
      return (
        <EmptyState
          action="Pair an environment group"
          body={
            corrupt
              ? 'The environments stored on this device could not be read. Pair again to restore the connection.'
              : 'Porcelain reviews work that happens on your machine. Pair the environment group running there to see it.'
          }
          onAction={(): void => router.push('/settings/pair')}
          title={
            corrupt ? 'Stored environments couldn’t be read' : 'Pair your first environment group'
          }
        />
      )
    case 'unauthorized':
      return (
        <EmptyState
          action="Pair again"
          body={`${environment?.nickname ?? 'That daemon'} revoked this device’s token, so it can no longer be reached.`}
          onAction={(): void => {
            if (environment === null) {
              router.push('/settings/pair')
              return
            }
            router.push({ pathname: '/settings/pair', params: { environmentId: environment.id } })
          }}
          title="This device was unpaired"
        />
      )
    case 'unreachable':
      return (
        <EmptyState
          action="Retry"
          body={`${connection.message} ${attemptedRoutes(connection.reachability.attempted.map((attempt) => attempt.kind))}`.trim()}
          onAction={(): void => {
            retryConnection()
          }}
          onSecondaryAction={(): void => router.push('/settings')}
          secondaryAction="Switch environment"
          title={`Can’t reach ${environment?.nickname ?? 'the daemon'}`}
        />
      )
    default:
      break
  }

  if (requires === 'repo' && repo === null) {
    return (
      <EmptyState
        action="Choose a repo"
        body="Every surface here reads one repository on the daemon, and this device has not opened one yet."
        onAction={(): void => router.push('/repo')}
        title="Choose a repo"
      />
    )
  }
  return <>{children}</>
}
