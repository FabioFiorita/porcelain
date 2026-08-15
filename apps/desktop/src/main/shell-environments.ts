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
  /** null = This device (the local child daemon). */
  id: string | null
  state: EnvironmentProbeState
  /** Which of the environment group's endpoints answered; null when none did. */
  endpoint: string | null
  /** Reported identity; null when the daemon is down or returned an invalid response. */
  host: string | null
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
const UNKNOWN_IDENTITY = { host: null, platform: null, version: null }

/**
 * Ask one daemon who it is. Never throws — a switcher row must render for an
 * environment that is asleep, and an unreachable box is a *state*, not an error.
 */
export async function probeEnvironment(
  url: string,
  token: string,
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
  return {
    state: 'online',
    host: info.host,
    platform: info.platform,
    version: info.version,
  }
}

async function probeEnvironmentEndpoints(
  env: RemoteEnvironment,
): Promise<Omit<EnvironmentStatus, 'id'>> {
  let firstFailure: Omit<EnvironmentStatus, 'id' | 'endpoint'> | null = null
  for (const url of orderedEndpoints(env)) {
    const status = await probeEnvironment(url, env.token)
    if (status.state === 'online') return { ...status, endpoint: url }
    if (status.state === 'unauthorized') return { ...status, endpoint: null }
    firstFailure ??= status
  }
  return { ...(firstFailure ?? { state: 'offline', ...UNKNOWN_IDENTITY }), endpoint: null }
}

/** Live state for This device and every saved Environment; group probes run in parallel. */
export async function readEnvironmentStatuses(): Promise<EnvironmentStatus[]> {
  const state = await loadRemoteEnvironmentState()
  const local = localDaemonPair()
  const [localStatus, ...remoteStatuses] = await Promise.all([
    probeEnvironment(local.url, local.token).then((status) => ({
      ...status,
      endpoint: local.url,
    })),
    ...state.environments.map(probeEnvironmentEndpoints),
  ])
  const healed = new Map(
    state.environments
      .map((env, index) => [env.id, remoteStatuses[index]?.endpoint ?? null] as const)
      .filter(([, endpoint]) => endpoint !== null),
  )
  if (healed.size > 0) {
    await updateRemoteEnvironmentState((current) => ({
      ...current,
      environments: current.environments.map((env) => {
        const endpoint = healed.get(env.id)
        return endpoint === undefined ||
          endpoint === null ||
          endpoint === env.url ||
          !env.endpoints.includes(endpoint)
          ? env
          : withActiveUrl(env, endpoint)
      }),
    }))
    const refreshed = await reloadEnvironmentsCache()
    for (const env of refreshed.environments) {
      const endpoint = healed.get(env.id)
      if (endpoint !== undefined && endpoint !== null && env.endpoints.includes(endpoint)) {
        setWindowRemoteEndpoint(env.id, { token: env.token, url: endpoint })
      }
    }
  }
  return [
    { id: null, ...localStatus },
    ...remoteStatuses.map((status, index) => ({
      id: state.environments[index]?.id ?? null,
      ...status,
    })),
  ]
}
