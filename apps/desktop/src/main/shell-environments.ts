import { z } from 'zod'
import { localDaemonPair, reloadEnvironmentsCache, setWindowRemoteEndpoint } from './daemon'
import { daemonHeaders } from './daemon-headers'
import {
  loadRemoteEnvironmentState,
  orderedEndpoints,
  type RemoteEnvironment,
  updateRemoteEnvironmentState,
  withActiveUrl,
} from './remote-daemon'

/**
 * How a saved environment is doing right now. `unauthorized` is deliberately NOT
 * folded into `offline`: a box that answers but rejects the token needs a different
 * fix (re-pair) than one that's asleep, and collapsing them sends the human to the
 * wrong remedy.
 */
type EnvironmentProbeState = 'online' | 'unauthorized' | 'offline'

export interface EnvironmentStatus {
  /** null = Local (the child daemon launched by this desktop app). */
  id: string | null
  state: EnvironmentProbeState
  /** Which of the environment group's endpoints answered; null when none did. */
  endpoint: string | null
  /** Reported identity; null when the daemon is down or returned an invalid response. */
  host: string | null
  /**
   * The daemon's DISPLAY name — its nickname when the human set one, otherwise its
   * machine name. Separate from `host` because two daemons with their own homes on ONE
   * machine report the same host: the nickname is the only thing that tells them apart.
   *
   * Null means UNKNOWN, never "has no nickname": the daemon is down, the caller did not
   * ask for identity, or the ask did not come back. A null must never be written over a
   * saved name — see `readEnvironmentIdentity`.
   */
  name: string | null
  platform: string | null
  version: string | null
}

// tRPC's HTTP GET envelope for a query result. Validated because it's an external
// response — a saved url could be answering with anything.
const daemonInfoResponseSchema = z.object({
  result: z.object({
    data: z.object({
      version: z.string(),
      host: z.string(),
      platform: z.string(),
      arch: z.string(),
    }),
  }),
})

// Short enough that a sleeping box doesn't stall the switcher behind the app's own
// boot, long enough for a tailnet round-trip on a phone hotspot.
const STATUS_PROBE_TIMEOUT_MS = 4000
const UNKNOWN_IDENTITY = { host: null, name: null, platform: null, version: null }

// The Environment's own identity document, which carries the human's nickname. Read
// separately from `daemonInfo` because that response is `.strict()` on every client
// already shipped — a client one version old would reject a daemon that added a field
// to it, and refuse to connect at all.
const environmentIdentityResponseSchema = z.object({
  result: z.object({ data: z.object({ name: z.string().min(1) }) }),
})

/**
 * What the identity question came back with — and `answered` is the load-bearing half.
 *
 * A daemon too old to know the procedure answers 404, which IS an answer ("no nickname
 * concept here") and settles for the machine name. A 503, a timeout, a network error or an
 * unreadable body are NOT answers: healing a saved nickname from one of those would replace
 * the human's label with the very host name the nickname exists to escape, permanently,
 * because nothing ever heals it back. The union is what stops a `?? host` from collapsing
 * the two cases again — it does not compile.
 */
type IdentityAnswer = { answered: true; name: string | null } | { answered: false }

const NOT_ANSWERED: IdentityAnswer = { answered: false }

/**
 * Ask one daemon for its display name. Never throws and never fails the probe: an
 * environment that cannot answer is still a row that has to render.
 */
async function readEnvironmentIdentity(url: string, token: string): Promise<IdentityAnswer> {
  try {
    const response = await fetch(`${url}/trpc/environmentIdentity`, {
      headers: daemonHeaders(token),
      signal: AbortSignal.timeout(STATUS_PROBE_TIMEOUT_MS),
    })
    // 404 is the one status that answers the question: this daemon predates nicknames.
    if (response.status === 404) return { answered: true, name: null }
    if (!response.ok) return NOT_ANSWERED
    const parsed = environmentIdentityResponseSchema.safeParse(await response.json())
    return parsed.success ? { answered: true, name: parsed.data.result.data.name } : NOT_ANSWERED
  } catch {
    return NOT_ANSWERED
  }
}

/**
 * Ask one daemon who it is. Never throws — a switcher row must render for an
 * environment that is asleep, and an unreachable box is a *state*, not an error.
 *
 * `identity` is opt-in because it is a SECOND round trip, up to the probe timeout again, on
 * every endpoint of every environment. Only the callers that display or persist the name pay
 * for it; the ones that just want "is this endpoint alive" do not.
 */
export async function probeEnvironment(
  url: string,
  token: string,
  options: { identity?: boolean } = {},
): Promise<Omit<EnvironmentStatus, 'id' | 'endpoint'>> {
  let response: Response
  try {
    response = await fetch(`${url}/trpc/daemonInfo`, {
      headers: daemonHeaders(token),
      signal: AbortSignal.timeout(STATUS_PROBE_TIMEOUT_MS),
    })
  } catch {
    return { state: 'offline', ...UNKNOWN_IDENTITY }
  }
  if (response.status === 401) return { state: 'unauthorized', ...UNKNOWN_IDENTITY }
  if (!response.ok) return { state: 'offline', ...UNKNOWN_IDENTITY }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { state: 'offline', ...UNKNOWN_IDENTITY }
  }
  const parsed = daemonInfoResponseSchema.safeParse(body)
  if (!parsed.success) return { state: 'offline', ...UNKNOWN_IDENTITY }
  const info = parsed.data.result.data
  const identity =
    options.identity === true ? await readEnvironmentIdentity(url, token) : NOT_ANSWERED
  return {
    state: 'online',
    host: info.host,
    // The machine name is the fallback only for a daemon that ANSWERED without a nickname.
    // An unanswered question leaves the name unknown — the caller must not write it down.
    name: identity.answered ? (identity.name ?? info.host) : null,
    platform: info.platform,
    version: info.version,
  }
}

/** Find a healthy endpoint in preference order; an unauthorized credential is shared by routes. */
export async function liveEndpoint(env: RemoteEnvironment): Promise<string | null> {
  for (const url of orderedEndpoints(env)) {
    const { state } = await probeEnvironment(url, env.token)
    if (state === 'online') return url
    if (state === 'unauthorized') return null
  }
  return null
}

/**
 * One reachable Environment the renderer may open its OWN session to.
 *
 * The window's bound daemon is never in this list — the renderer already has it as
 * `primary`. Everything else is a SECOND connection, the same shape `localDaemon` has handed
 * over since local terminals shipped: a URL and the paired credential for it. That is what
 * makes a Terminal, a directory browse, or a roster on another machine possible without the
 * main process proxying every byte; the alternative is a bespoke IPC bridge per feature.
 *
 * `id` is the SHELL identity — `null` is This device — and the renderer maps it to the
 * daemon-announced Environment id through the Hub inventory it already reads.
 */
export interface EnvironmentConnection {
  id: string | null
  name: string
  url: string
  token: string
}

/**
 * Every Environment this window can reach EXCEPT the one it is bound to, each pointed at an
 * endpoint that answered just now. An Environment with no live endpoint is omitted rather
 * than handed over as a dead URL: the renderer would open a socket and retry it forever.
 */
export async function readEnvironmentConnections(
  currentEnvironmentId: string | null,
): Promise<EnvironmentConnection[]> {
  const state = await loadRemoteEnvironmentState()
  const local = localDaemonPair()
  const [localOnline, remoteEndpoints] = await Promise.all([
    currentEnvironmentId === null || local.url === ''
      ? Promise.resolve(false)
      : probeEnvironment(local.url, local.token).then((status) => status.state === 'online'),
    Promise.all(
      state.environments.map(
        async (env): Promise<string | null> =>
          env.id === currentEnvironmentId ? null : await liveEndpoint(env),
      ),
    ),
  ])
  const connections: EnvironmentConnection[] = localOnline
    ? [{ id: null, name: 'Local', ...local }]
    : []
  for (const [index, env] of state.environments.entries()) {
    const url = remoteEndpoints[index]
    if (url === null || url === undefined) continue
    connections.push({ id: env.id, name: env.name, url, token: env.token })
  }
  return connections
}

async function probeEnvironmentEndpoints(
  env: RemoteEnvironment,
): Promise<Omit<EnvironmentStatus, 'id'>> {
  let firstFailure: Omit<EnvironmentStatus, 'id' | 'endpoint'> | null = null
  for (const url of orderedEndpoints(env)) {
    const status = await probeEnvironment(url, env.token, { identity: true })
    if (status.state === 'online') return { ...status, endpoint: url }
    if (status.state === 'unauthorized') return { ...status, endpoint: null }
    firstFailure ??= status
  }
  return { ...(firstFailure ?? { state: 'offline', ...UNKNOWN_IDENTITY }), endpoint: null }
}

/** Live state for Local and every saved Environment; group probes run in parallel. */
export async function readEnvironmentStatuses(): Promise<EnvironmentStatus[]> {
  const state = await loadRemoteEnvironmentState()
  const local = localDaemonPair()
  const [localStatus, ...remoteStatuses] = await Promise.all([
    probeEnvironment(local.url, local.token, { identity: true }).then((status) => ({
      ...status,
      endpoint: local.url,
    })),
    ...state.environments.map(probeEnvironmentEndpoints),
  ])
  const healed = new Map(
    state.environments
      .map(
        (env, index) =>
          [
            env.id,
            {
              endpoint: remoteStatuses[index]?.endpoint ?? null,
              // The saved name was frozen at pairing time. Refresh it from the daemon that
              // owns the Environment, so a nickname set on the box shows up here — and
              // survives in the picker after that box goes to sleep. Null is "unknown", not
              // "no nickname", and never heals anything.
              name: remoteStatuses[index]?.name ?? null,
              // The name this probe started from. The fan-out above took SECONDS, and a
              // rename can land inside that window; writing the probed name back regardless
              // would silently revert it. Same lost-update rule the endpoint half follows by
              // keying on id — this half compares before it swaps.
              previousName: env.name,
            },
          ] as const,
      )
      .filter(([, heal]) => heal.endpoint !== null || heal.name !== null),
  )
  if (healed.size > 0) {
    await updateRemoteEnvironmentState((current) => ({
      ...current,
      environments: current.environments.map((env) => {
        const heal = healed.get(env.id)
        if (heal === undefined) return env
        const stale = env.name !== heal.previousName
        const named =
          heal.name !== null && heal.name !== env.name && !stale ? { ...env, name: heal.name } : env
        return heal.endpoint === null ||
          heal.endpoint === named.url ||
          !named.endpoints.includes(heal.endpoint)
          ? named
          : withActiveUrl(named, heal.endpoint)
      }),
    }))
    const refreshed = await reloadEnvironmentsCache()
    for (const env of refreshed.environments) {
      const endpoint = healed.get(env.id)?.endpoint
      if (endpoint !== undefined && endpoint !== null && env.endpoints.includes(endpoint)) {
        setWindowRemoteEndpoint(env.id, { token: env.token, url: endpoint })
      }
    }
  }
  return [
    { id: null, ...localStatus, name: 'Local' },
    ...remoteStatuses.map((status, index) => ({
      id: state.environments[index]?.id ?? null,
      ...status,
    })),
  ]
}
