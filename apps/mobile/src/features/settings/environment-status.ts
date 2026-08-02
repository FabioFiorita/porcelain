import type { Environment } from '@/lib/daemon/environment'
import type { ConnectionState } from '@/lib/daemon/environments-store'

/** iOS system colours: gray idle, green connected, orange unreachable, red revoked. */
const STATUS_COLORS = {
  idle: '#8E8E93',
  ready: '#34C759',
  unreachable: '#FF9500',
  unauthorized: '#FF3B30',
} as const

function describeConnection(connection: ConnectionState): {
  color: string
  label: string
} {
  switch (connection.kind) {
    case 'ready':
      return { color: STATUS_COLORS.ready, label: connection.daemonVersion }
    case 'unreachable':
      return { color: STATUS_COLORS.unreachable, label: 'Unreachable' }
    case 'unauthorized':
      return { color: STATUS_COLORS.unauthorized, label: 'Token revoked' }
    case 'connecting':
    case 'loading':
      return { color: STATUS_COLORS.idle, label: 'Connecting…' }
    case 'no-environment':
      return { color: STATUS_COLORS.idle, label: 'Not connected' }
  }
}

export function describeEnvironment(
  environment: Environment,
  active: Environment | null,
  connection: ConnectionState,
): { color: string; label: string } {
  if (active?.id === environment.id) return describeConnection(connection)
  return {
    color: environment.token === null ? STATUS_COLORS.unauthorized : STATUS_COLORS.idle,
    label: environment.token === null ? 'Token revoked' : 'Paired',
  }
}
