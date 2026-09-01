import { chmod, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type EndpointKind, endpointKind, orderedEndpointUrls } from '@porcelain/contracts'
import { app } from 'electron'
import { z } from 'zod'

export { type EndpointKind, endpointKind }

/**
 * Shell-side persistence for saved environment groups.
 *
 * The shell owns the list of known daemons (the choice CANNOT live in the
 * daemon's own config — that config lives on whichever machine the daemon runs
 * on — circular). It's a small file, `remote-daemon.json`, in the shell's
 * userData dir: a list of named groups with verified endpoints plus
 * `activeId`, which is only the DEFAULT for new/restore windows (null = local).
 * Each open window has its OWN binding in memory (daemon.ts) — so one window can
 * be on This device while another is on the Beelink.
 *
 * Device tokens are stored in plaintext in Electron's user-owned data directory.
 * Each token is individually revocable and only gates the daemon the human paired.
 * Never log them.
 */

/**
 * Where an environment can be reached. One machine is usually SEVERAL of these — a LAN
 * address at home and a tailnet address away — so ONE environment holds many endpoints
 * instead of appearing as two confusingly-named rows. The kind is DERIVED from the
 * address (see `endpointKind`), never stored: a DHCP lease changes the address and a
 * stored kind would then describe the wrong thing. The human's preference is persisted
 * BY EXACT ENDPOINT; kind is only a display hint, so two `other` routes cannot both be primary.
 */
const environmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The last known good endpoint — always one of `endpoints`. What a window binds to. */
  url: z.string().url(),
  token: z.string(),
  /** The daemon's reported hostname, so a second pairing of the same machine merges. */
  host: z.string().optional(),
  /** Every verified address for this machine, most-recently-added last. */
  endpoints: z.array(z.string().url()).min(1),
  /** Which exact endpoint to try first. */
  preferredEndpoint: z.string().url(),
})
export type RemoteEnvironment = z.infer<typeof environmentSchema>

const stateSchema = z
  .object({
    activeId: z.string().nullable(),
    environments: z.array(environmentSchema),
  })
  .strict()
const persistedStateSchema = stateSchema.extend({ version: z.literal(1) }).strict()
export type RemoteEnvironmentState = z.infer<typeof stateSchema>

/** The resolved daemon pair a window can be pointed at. */
export type RemoteDaemon = { url: string; token: string }

const EMPTY_STATE: RemoteEnvironmentState = { activeId: null, environments: [] }

const filePath = (): string => join(app.getPath('userData'), 'remote-daemon.json')
const recoveryPath = (): string => `${filePath()}.recovery`

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

export class RemoteEnvironmentStateError extends Error {
  readonly recoveryPath: string

  constructor(path: string) {
    super(
      `Saved Environments could not be read. A recovery copy is at ${path}. Restore or remove remote-daemon.json, then reopen Porcelain.`,
    )
    this.name = 'RemoteEnvironmentStateError'
    this.recoveryPath = path
  }
}

/**
 * Parse the current versioned document and the immediately preceding unversioned group shape.
 * Invalid and future-version documents fail closed; callers must never turn them into empty state.
 */
export function parseRemoteEnvironmentState(json: unknown): RemoteEnvironmentState {
  const current = persistedStateSchema.safeParse(json)
  if (current.success) {
    return { activeId: current.data.activeId, environments: current.data.environments }
  }
  const legacy = stateSchema.safeParse(json)
  if (legacy.success) return legacy.data
  throw new Error('Unsupported or invalid remote environment state')
}

async function preserveInvalidState(raw: string): Promise<string> {
  const path = recoveryPath()
  try {
    await writeFile(path, raw, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'EEXIST') throw error
  }
  await chmod(path, 0o600)
  return path
}

/** The persisted state. Only a genuinely absent file means an empty environment list. */
export async function loadRemoteEnvironmentState(): Promise<RemoteEnvironmentState> {
  const path = filePath()
  let raw: string
  try {
    // Repair older files before reading them so an overly restrictive-but-owned file recovers too.
    await chmod(path, 0o600)
    raw = await readFile(path, 'utf8')
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return EMPTY_STATE
    throw new Error(
      `Saved Environments could not be read at ${path}. Check its ownership and permissions.`,
    )
  }
  try {
    return parseRemoteEnvironmentState(JSON.parse(raw))
  } catch {
    throw new RemoteEnvironmentStateError(await preserveInvalidState(raw))
  }
}

/** Persist the state (owner-only atomic tmp+rename, repairing any older final mode). */
let saveCounter = 0

export async function saveRemoteEnvironmentState(state: RemoteEnvironmentState): Promise<void> {
  const path = filePath()
  saveCounter += 1
  const tmp = `${path}.tmp-${process.pid}-${saveCounter}`
  try {
    await writeFile(tmp, JSON.stringify({ version: 1, ...state }, null, 2), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    await chmod(tmp, 0o600)
    await rename(tmp, path)
    await chmod(path, 0o600)
  } finally {
    await unlink(tmp).catch((error: unknown) => {
      if (!isNodeError(error) || error.code !== 'ENOENT') throw error
    })
  }
}

/**
 * Serialized read-modify-write — the ONLY sanctioned way to change this file. A bare
 * `load → mutate → save` is a lost update: `environmentStatuses` loads the state, spends
 * SECONDS probing endpoints, then writes its snapshot back, so an add or remove landing
 * inside that window is silently undone — including resurrecting a removed environment
 * with its plaintext token, the direction that actually matters. Read inside the callback
 * and key edits by environment id, never by an index into a pre-await snapshot.
 */
let writeChain: Promise<void> = Promise.resolve()

export function updateRemoteEnvironmentState(
  mutate: (state: RemoteEnvironmentState) => RemoteEnvironmentState,
): Promise<void> {
  const run = writeChain.then(async () => {
    await saveRemoteEnvironmentState(mutate(await loadRemoteEnvironmentState()))
  })
  // The rejection belongs to the caller that got `run`; the chain only needs a settled
  // tail so the next writer still runs.
  writeChain = Promise.allSettled([run]).then(() => undefined)
  return run
}

/**
 * Resolve the active environment to the `{ url, token }` pair the daemon module
 * needs. Null when nothing is active, or when `activeId` dangles (points at an
 * environment that no longer exists). Pure — unit-tested.
 */
export function activeRemoteDaemon(state: RemoteEnvironmentState): RemoteDaemon | null {
  if (state.activeId === null) return null
  const active = state.environments.find((env) => env.id === state.activeId)
  return active ? { url: active.url, token: active.token } : null
}

/** Every verified address for an environment group. */
export function endpointsOf(env: RemoteEnvironment): string[] {
  return [...env.endpoints]
}

/**
 * The order to TRY an environment's endpoints in: the preferred endpoint first, then the last
 * known good url, then the rest as stored, deduped. Ordering matters more than it looks:
 * on the home LAN the tailnet address usually still *works*, just slower (out to the
 * WireGuard relay and back), so "first one that answers" would quietly pick the worse
 * route. Preference decides; reachability only breaks ties. Pure — unit-tested.
 */
export function orderedEndpoints(env: RemoteEnvironment): string[] {
  return orderedEndpointUrls(env)
}

/** Add an address to an environment's endpoint list (idempotent). Pure. */
export function withEndpoint(env: RemoteEnvironment, url: string): RemoteEnvironment {
  const endpoints = endpointsOf(env)
  return endpoints.includes(url)
    ? { ...env, endpoints }
    : { ...env, endpoints: [...endpoints, url] }
}

/**
 * Record the endpoint that just answered as the last known good one. Deliberately does NOT
 * touch `preferredEndpoint`: reachability is not a preference. A LAN-preferring human who
 * opens the laptop on a train should come back home to the LAN, not to the tailnet address
 * that happened to work in transit — only an explicit choice moves the preference.
 */
export function withActiveUrl(env: RemoteEnvironment, url: string): RemoteEnvironment {
  return withEndpoint({ ...env, url }, url)
}

/** Drop an address; a no-op if it is the only one left (an environment needs a way in). */
export function withoutEndpoint(env: RemoteEnvironment, url: string): RemoteEnvironment {
  const endpoints = endpointsOf(env).filter((u) => u !== url)
  if (endpoints.length === 0) return env
  const preferredEndpoint =
    env.preferredEndpoint === url ? (endpoints[0] ?? env.preferredEndpoint) : env.preferredEndpoint
  return {
    ...env,
    endpoints,
    preferredEndpoint,
    url: endpoints.includes(env.url) ? env.url : (endpoints[0] ?? env.url),
  }
}

/**
 * Normalize and validate a user-typed daemon url: strip a trailing slash and
 * require an http:// or https:// prefix. Throws a clean, user-facing message on
 * anything else (empty, a bare host, a ws:// url, garbage). Pure — unit-tested.
 */
export function normalizeDaemonUrl(input: string): string {
  const trimmed = input.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Enter a full URL starting with http:// or https://')
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('That does not look like a valid URL')
  }
  // Drop a trailing slash on the path so `<url>/trpc/...` never doubles up.
  return url.toString().replace(/\/$/, '')
}
