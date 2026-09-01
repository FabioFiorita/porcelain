import { endpointKind } from '@porcelain/contracts'

import { type ConnectionState, type Environment, hostOf } from '@/features/remote'

/**
 * What the environments panel says, and the endpoint orders it writes — with no React in them.
 *
 * Every line in the panel is a sentence assembled from a connection state, a route count, and a
 * URL, and every reorder is a small array edit. Both were inline in the panel, which is why a
 * mislabelled state or an off-by-one swap could only be found on a device.
 */

/** True for `127.0.0.0/8` and `::1` — this device, not a route to another one. */
function isLoopback(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  return host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host)
}

/**
 * The three shapes of route a daemon can be reached over, named the way a human picks between
 * them.
 *
 * Loopback gets its own case rather than folding into `endpointKind`'s classification: that
 * function also drives failover order, where a stale loopback endpoint from a same-machine dev
 * pairing must stay deprioritized behind a real LAN or Tailscale route, not jump ahead of them.
 * The label is a separate concern — a daemon on this exact device is not "the internet."
 */
export function endpointLabel(url: string): string {
  if (isLoopback(url)) return 'LAN'
  switch (endpointKind(url)) {
    case 'lan':
      return 'LAN'
    case 'tailnet':
      return 'Tailscale'
    case 'other':
      return 'Cloudflare / Internet'
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
    case 'update-required':
      return 'A protocol update is required.'
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
      // cleanupError means the in-memory token is gone but secure-store deletion failed —
      // surface the persisted-token risk in the environments list (production consumer).
      return connection.cleanupError !== undefined
        ? `Token rejected · credential cleanup failed · ${routes}`
        : `Token rejected · ${routes}`
    case 'no-environment':
      return routes
    case 'update-required':
      return `A protocol update is required. · ${routes}`
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
