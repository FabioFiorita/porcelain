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

const STORAGE_KEY = 'porcelain-browser-environments'
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
export function browserEnvironmentConnections(): readonly BrowserEnvironmentConnection[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(connectionShape)
  } catch {
    return []
  }
}

/** Persist browser connections; useful to pairing/settings surfaces and isolated proof fixtures. */
export function setBrowserEnvironmentConnections(
  connections: readonly BrowserEnvironmentConnection[],
): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connections))
  for (const connection of connections) ensureEnvironmentSession(connection)
}

const secondarySessions = new Map<string, EnvironmentSession>()
const primaryClient = createAppClientFor(primary)
const environmentAliases = new Map<string, string>()
let primaryEnvironmentId: string | null = null

/** Record the daemon-announced identity used to resolve the primary target. */
export function setPrimaryEnvironmentId(id: string | null): void {
  primaryEnvironmentId = id
}

/** Associate a daemon-announced identity with the client-local connection label. */
export function registerEnvironmentAlias(environmentId: string, connectionId: string): void {
  environmentAliases.set(environmentId, connectionId)
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

/** Resolve the session that owns an explicit Environment target. `null` is this page's daemon. */
export function environmentSessionFor(environmentId: string | null): EnvironmentSession | null {
  if (environmentId === null || environmentId === primaryEnvironmentId) {
    return {
      id: primaryEnvironmentId ?? 'primary',
      name: 'This device',
      session: primary,
      client: primaryClient,
    }
  }
  const connectionId = environmentAliases.get(environmentId) ?? environmentId
  const connection = browserEnvironmentConnections().find((item) => item.id === connectionId)
  return connection === undefined ? null : ensureEnvironmentSession(connection)
}
