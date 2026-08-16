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

export type BrowserEnvironmentConnectionInput = Readonly<{
  name: string
  url: string
  token: string
}>

export type BrowserEnvironmentIdentity = Readonly<{
  host: string
  platform: string
  version: string
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

function connectionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function connectionFailure(error: unknown): Error {
  const code =
    error !== null && typeof error === 'object' && 'data' in error
      ? (error as { data?: { code?: unknown } }).data?.code
      : undefined
  if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') {
    return new Error('The daemon rejected this client token. Use a paired client token.')
  }
  // Browsers intentionally collapse a failed cross-origin preflight/fetch into a generic
  // network error. Give the human the one safe, actionable distinction without ever echoing
  // the submitted credential: the Hub origin is public metadata, while the token remains only
  // in the password field and client-local storage.
  const hubOrigin = typeof window === 'undefined' ? '' : window.location.origin
  const corsHint =
    hubOrigin === '' || hubOrigin === 'null'
      ? ' If it is reachable from this browser, check the daemon CORS configuration.'
      : ` If it is reachable from this Hub, configure PORCELAIN_ALLOWED_ORIGIN=${hubOrigin} on the daemon and restart it (CORS).`
  return new Error(`Could not reach that daemon. Check the URL and that it is shared.${corsHint}`)
}

/**
 * Verify a browser connection against the daemon before it enters client-local storage.
 * The format check deliberately rejects the host administrator token: browser connections
 * are scoped to revocable `pc_client_…` credentials only.
 */
export async function addBrowserEnvironmentConnection(
  input: BrowserEnvironmentConnectionInput,
): Promise<BrowserEnvironmentIdentity> {
  const name = input.name.trim()
  const token = input.token.trim()
  let url: URL
  try {
    url = new URL(input.url.trim())
  } catch {
    throw new Error('Enter a valid daemon URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Daemon URL must use http or https.')
  }
  if (name.length === 0 || name.length > 80) throw new Error('Enter a label up to 80 characters.')
  if (!token.startsWith('pc_client_')) {
    throw new Error('Use a paired client token, not the host administrator token.')
  }

  const connection: BrowserEnvironmentConnection = {
    id: connectionId(),
    name,
    url: url.toString().replace(/\/$/, ''),
    token,
  }
  const session = createDaemonSession(endpointFor(connection))
  const client = createAppClientFor(session)
  try {
    const identity = await client.daemonInfo.query()
    setBrowserEnvironmentConnections([...browserEnvironmentConnections(), connection])
    return identity
  } catch (error) {
    session.stop()
    throw connectionFailure(error)
  }
}

export function removeBrowserEnvironmentConnection(id: string): void {
  setBrowserEnvironmentConnections(browserEnvironmentConnections().filter((item) => item.id !== id))
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
