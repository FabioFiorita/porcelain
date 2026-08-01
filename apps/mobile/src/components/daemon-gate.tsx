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
          action="Pair a daemon"
          body={
            corrupt
              ? 'The environments stored on this device could not be read. Pair again to restore the connection.'
              : 'Porcelain reviews work that happens on your machine. Pair the daemon running there to see it.'
          }
          onAction={(): void => router.push('/settings/pair')}
          title={corrupt ? 'Stored environments couldn’t be read' : 'Pair your first daemon'}
        />
      )
    case 'unauthorized':
      return (
        <EmptyState
          action="Pair again"
          body={`${environment?.nickname ?? 'That daemon'} revoked this device’s token, so it can no longer be reached.`}
          onAction={(): void => router.push('/settings/pair')}
          title="This device was unpaired"
        />
      )
    case 'unreachable':
      return (
        <EmptyState
          action="Retry"
          body={connection.message}
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
        action="Open settings"
        body="Every surface here reads one repository on the daemon, and this device has not opened one yet."
        onAction={(): void => router.push('/settings')}
        title="Choose a repo"
      />
    )
  }
  return <>{children}</>
}
