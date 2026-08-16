import { useSyncExternalStore } from 'react'
import { createDaemonSession, type DaemonEndpoint, type DaemonSession, primary } from './daemon'
import { createAppClientFor } from './trpc'

/**
 * A browser client may keep more than one authenticated daemon session in one Hub.
 * Credentials are deliberately client-local: the daemon remains the authority for its
 * own identity and records, and no token is ever sent through another daemon.
 */
export type BrowserEnvironmentConnection = Readonly<{
  id: string
  name: string
  url: string
  token: string
}>

export type EnvironmentSession = Readonly<{
  id: string
  name: string
  session: DaemonSession
  client: ReturnType<typeof createAppClientFor>
}>

export type EnvironmentClient = Readonly<{
  client: EnvironmentSession['client']
  session: DaemonSession | null
}>

/** Every daemon this browser has configured and can currently keep live. The primary session is
 * always first; secondary entries are client-local connections, never guessed from a Hub row. */
export type LiveEnvironmentSession = Readonly<{
  environmentId: string | null
  connectionId: string | null
  name: string
  session: DaemonSession
  client: EnvironmentSession['client']
}>

/** Cache scope for an owner: the primary daemon keeps its announced host, while secondary
 * sessions use their Environment id so independent daemon caches cannot collide. */
export function daemonScopeForEnvironment(
  environmentId: string | null | undefined,
  identity: { host: string | null; version: string | null },
): { host: string | null; version: string | null } {
  return {
    host:
      environmentId === undefined ||
      environmentId === null ||
      environmentId === primaryEnvironmentId
        ? identity.host
        : environmentId,
    version: identity.version,
  }
}

const STORAGE_KEY = 'porcelain-browser-environments'
let environmentSessionRevision = 0
const environmentSessionListeners = new Set<() => void>()

function notifyEnvironmentSessionChange(): void {
  environmentSessionRevision += 1
  for (const listener of environmentSessionListeners) listener()
}

/** React subscription edge for alias/session topology changes discovered asynchronously. */
function subscribeEnvironmentSessions(listener: () => void): () => void {
  environmentSessionListeners.add(listener)
  return () => environmentSessionListeners.delete(listener)
}

function environmentSessionsRevision(): number {
  return environmentSessionRevision
}

function removeStaleEnvironmentSessions(ids: ReadonlySet<string>): void {
  for (const [connectionId, entry] of secondarySessions) {
    if (!ids.has(connectionId)) {
      entry.session.stop()
      secondarySessions.delete(connectionId)
    }
  }
}

export function useEnvironmentSessionsRevision(): number {
  return useSyncExternalStore(
    subscribeEnvironmentSessions,
    environmentSessionsRevision,
    environmentSessionsRevision,
  )
}

const connectionShape = (value: unknown): value is BrowserEnvironmentConnection => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    typeof record.name === 'string' &&
    record.name.length > 0 &&
    typeof record.url === 'string' &&
    record.url.length > 0 &&
    typeof record.token === 'string' &&
    record.token.length > 0
  )
}

/** Read explicit browser connections. Malformed client-local state is ignored safely. */
export function browserEnvironmentConnections(
  _revision = environmentSessionRevision,
): readonly BrowserEnvironmentConnection[] {
  if (typeof window === 'undefined') return []
  let connections: readonly BrowserEnvironmentConnection[] = []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (Array.isArray(parsed)) connections = parsed.filter(connectionShape)
  } catch {
    connections = []
  }
  const ids = new Set(connections.map((connection) => connection.id))
  for (const [environmentId, connectionId] of environmentAliases) {
    if (!ids.has(connectionId)) environmentAliases.delete(environmentId)
  }
  removeStaleEnvironmentSessions(ids)
  return connections
}

/** Persist browser connections; useful to pairing/settings surfaces and isolated proof fixtures. */
export function setBrowserEnvironmentConnections(
  connections: readonly BrowserEnvironmentConnection[],
): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connections))
  const ids = new Set(connections.map((connection) => connection.id))
  for (const [environmentId, connectionId] of environmentAliases) {
    if (!ids.has(connectionId)) environmentAliases.delete(environmentId)
  }
  removeStaleEnvironmentSessions(ids)
  for (const connection of connections) ensureEnvironmentSession(connection)
  notifyEnvironmentSessionChange()
}

const secondarySessions = new Map<string, EnvironmentSession>()
let primaryClient: ReturnType<typeof createAppClientFor> | null = null
const environmentAliases = new Map<string, string>()
let primaryEnvironmentId: string | null = null

function primaryAppClient(): ReturnType<typeof createAppClientFor> {
  primaryClient ??= createAppClientFor(primary)
  return primaryClient
}

/** Record the daemon-announced identity used to resolve the primary target. */
export function setPrimaryEnvironmentId(id: string | null): void {
  if (primaryEnvironmentId === id) return
  primaryEnvironmentId = id
  notifyEnvironmentSessionChange()
}

/** Associate a daemon-announced identity with the client-local connection label. */
export function registerEnvironmentAlias(environmentId: string, connectionId: string): void {
  let changed = environmentAliases.get(environmentId) !== connectionId
  for (const [knownEnvironmentId, knownConnectionId] of environmentAliases) {
    if (knownEnvironmentId !== environmentId && knownConnectionId === connectionId) {
      environmentAliases.delete(knownEnvironmentId)
      changed = true
    }
  }
  environmentAliases.set(environmentId, connectionId)
  if (changed) notifyEnvironmentSessionChange()
}

function endpointFor(connection: BrowserEnvironmentConnection): DaemonEndpoint {
  return { url: connection.url, token: connection.token }
}

/** Create or re-point one secondary session; repeated renders never open duplicate sockets. */
export function ensureEnvironmentSession(
  connection: BrowserEnvironmentConnection,
): EnvironmentSession {
  const existing = secondarySessions.get(connection.id)
  if (existing === undefined) {
    const session = createDaemonSession(endpointFor(connection))
    const value = {
      id: connection.id,
      name: connection.name,
      session,
      client: createAppClientFor(session),
    }
    secondarySessions.set(connection.id, value)
    return value
  }
  const endpoint = existing.session.endpoint()
  if (endpoint.url !== connection.url || endpoint.token !== connection.token) {
    existing.session.setEndpoint(endpointFor(connection))
  }
  return existing
}

/** Snapshot the live session set for notification bridges and watch-interest ownership. */
export function liveEnvironmentSessions(
  _revision = environmentSessionRevision,
): readonly LiveEnvironmentSession[] {
  const primaryEntry: LiveEnvironmentSession = {
    environmentId: primaryEnvironmentId,
    connectionId: null,
    name: 'This device',
    session: primary,
    client: primaryAppClient(),
  }
  const secondary = browserEnvironmentConnections().map((connection) => {
    const entry = ensureEnvironmentSession(connection)
    return {
      environmentId: environmentAliasesForConnection(connection.id) ?? connection.id,
      connectionId: connection.id,
      name: connection.name,
      session: entry.session,
      client: entry.client,
    }
  })
  return [primaryEntry, ...secondary]
}

function environmentAliasesForConnection(connectionId: string): string | null {
  for (const [environmentId, alias] of environmentAliases) {
    if (alias === connectionId) return environmentId
  }
  return null
}

/** Resolve the session that owns an explicit Environment target. `null` is this page's daemon. */
export function environmentSessionFor(environmentId: string | null): EnvironmentSession | null {
  if (environmentId === null || environmentId === primaryEnvironmentId) {
    return {
      id: primaryEnvironmentId ?? 'primary',
      name: 'This device',
      session: primary,
      client: primaryAppClient(),
    }
  }
  const connectionId = environmentAliases.get(environmentId) ?? environmentId
  const connections = browserEnvironmentConnections()
  const connection = connections.find((item) => item.id === connectionId)
  return connection === undefined ? null : ensureEnvironmentSession(connection)
}

/** Resolve a Hub target during the short primary-identity bootstrap window. Hub rows can carry
 * the serving daemon's announced Environment id before `daemonInfo` has published that id to
 * this client; those rows still belong to the primary session. Unknown ids after bootstrap are
 * refused rather than silently routed to the primary daemon. */
export function environmentSessionForHubTarget(
  environmentId: string | null,
  _revision = environmentSessionRevision,
): EnvironmentSession | null {
  const direct = environmentSessionFor(environmentId)
  if (direct !== null || environmentId === null || primaryEnvironmentId !== null) return direct
  if (browserEnvironmentConnections().some((connection) => connection.id === environmentId)) {
    return null
  }
  return {
    id: 'primary',
    name: 'This device',
    session: primary,
    client: primaryAppClient(),
  }
}

/** Resolve an explicit target to its owning client; unknown Environment ids refuse. */
export function environmentClientFor(
  environmentId: string | null,
  primary: EnvironmentSession['client'],
): EnvironmentClient | null {
  if (environmentId === null || environmentId === primaryEnvironmentId) {
    return { client: primary, session: null }
  }
  const owner = environmentSessionFor(environmentId)
  return owner === null ? null : { client: owner.client, session: owner.session }
}
