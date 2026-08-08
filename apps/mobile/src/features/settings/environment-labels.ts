import { endpointKind } from '@porcelain/contracts'

import type { Environment } from '@/lib/daemon/environment'
import { hostOf } from '@/lib/daemon/environment'
import type { ConnectionState } from '@/lib/daemon/environments-store'

/**
 * What the environments panel says, and the endpoint orders it writes — with no React in them.
 *
 * Every line in the panel is a sentence assembled from a connection state, a route count, and a
 * URL, and every reorder is a small array edit. Both were inline in the panel, which is why a
 * mislabelled state or an off-by-one swap could only be found on a device.
 */

/** The three shapes of route a daemon can be reached over, named the way a human picks between them. */
export function endpointLabel(url: string): string {
  switch (endpointKind(url)) {
    case 'lan':
      return 'LAN'
    case 'tailnet':
      return 'Tailscale'
    case 'other':
      return 'Funnel / Internet'
  }
}

export function connectionStatusLabel(kind: ConnectionState['kind']): string {
  switch (kind) {
    case 'ready':
      return 'Connected'
    case 'connecting':
    case 'loading':
      return 'Connecting…'
    case 'unreachable':
      return 'Unreachable'
    case 'unauthorized':
      return 'Token rejected'
    case 'no-environment':
      return 'None'
  }
}

/**
 * The list row's subtitle. Only the active group has a live connection to report; the rest are
 * described by what this device has saved about them.
 */
export function describeConnection(
  environment: Environment,
  isActive: boolean,
  connection: ConnectionState,
): string {
  const count = environment.endpoints.length
  const routes = `${count} connection${count === 1 ? '' : 's'}`
  if (!isActive) {
    if (environment.token === null) return `Unpaired · ${routes}`
    return `${hostOf(environment.preferredEndpoint)} · ${routes}`
  }
  switch (connection.kind) {
    case 'loading':
    case 'connecting':
      return `Connecting… · ${routes}`
    case 'ready':
      return `daemon ${connection.daemonVersion} · ${routes}`
    case 'unreachable':
      return `Unreachable · ${routes}`
    case 'unauthorized':
      return `Token rejected · ${routes}`
    case 'no-environment':
      return routes
  }
}

/**
 * Promotion also hoists the row to the top. The client walks `preferredEndpoint` first and
 * the rest in array order, so leaving a promoted row sitting third made the list disagree
 * with the failover it was describing — the reader had to hold two orders in their head.
 */
export function promotedOrder(endpoints: readonly string[], url: string): string[] {
  return [url, ...endpoints.filter((candidate) => candidate !== url)]
}

/**
 * One step of the reorder buttons. `null` means the move runs off the end of the list — the
 * caller writes nothing rather than writing the order back unchanged.
 */
export function movedOrder(
  endpoints: readonly string[],
  index: number,
  direction: -1 | 1,
): string[] | null {
  const target = index + direction
  if (target < 0 || target >= endpoints.length) return null
  const next = [...endpoints]
  const current = next[index]
  const swap = next[target]
  if (current === undefined || swap === undefined) return null
  next[index] = swap
  next[target] = current
  return next
}
