import { environmentIdentitySchema } from '@porcelain/contracts/projects'
import { createTRPCUntypedClient, httpLink } from '@trpc/client'
import { localDaemonPair, reloadEnvironmentsCache } from './daemon'
import { daemonHeaders } from './daemon-headers'
import {
  loadRemoteEnvironmentState,
  orderedEndpoints,
  updateRemoteEnvironmentState,
} from './remote-daemon'
import { probeEnvironment } from './shell-environments'

/**
 * Naming an Environment from a window that is not bound to it.
 *
 * The nickname belongs to the daemon that owns the Environment — two daemons with their own
 * homes on ONE machine announce the same `host`, so a per-client label would have to be
 * retyped on every device that pairs with them. But the renderer holds exactly one daemon
 * client (its own window's), and the whole point of the feature is telling apart rows the
 * human can SEE side by side in Settings. Only the shell can reach both, so the rename is
 * routed here — one named target, never a fan-out write.
 *
 * The saved group name is refreshed with whatever the daemon answers, so the picker shows
 * the new label immediately instead of waiting for the next status probe.
 */

/** Resolve the daemon pair for an Environment id, or fail loudly rather than guessing. */
async function daemonFor(
  environmentId: string | null,
): Promise<{ url: string; token: string; name: string }> {
  if (environmentId === null) {
    const local = localDaemonPair()
    if (local.url === '') throw new Error('The local daemon is not running')
    return { ...local, name: 'This device' }
  }
  const state = await loadRemoteEnvironmentState()
  const environment = state.environments.find((candidate) => candidate.id === environmentId)
  if (environment === undefined) throw new Error('That environment is no longer connected')
  for (const url of orderedEndpoints(environment)) {
    if ((await probeEnvironment(url, environment.token)).state === 'online') {
      return { url, token: environment.token, name: environment.name }
    }
  }
  throw new Error(`${environment.name} is not reachable right now`)
}

/**
 * Set (or, with a blank name, clear) one Environment's nickname on its own daemon.
 * Returns the display name the daemon settled on — the machine name when cleared.
 */
export async function renameEnvironment(input: {
  environmentId: string | null
  name: string
}): Promise<{ environmentId: string | null; name: string }> {
  const daemon = await daemonFor(input.environmentId)
  const client = createTRPCUntypedClient({
    links: [httpLink({ url: `${daemon.url}/trpc`, headers: daemonHeaders(daemon.token) })],
  })
  const identity = environmentIdentitySchema.parse(
    await client.mutation('renameEnvironment', { name: input.name }),
  )

  if (input.environmentId !== null) {
    await updateRemoteEnvironmentState((state) => ({
      ...state,
      environments: state.environments.map((environment) =>
        environment.id === input.environmentId
          ? { ...environment, name: identity.name }
          : environment,
      ),
    }))
    await reloadEnvironmentsCache()
  }
  return { environmentId: input.environmentId, name: identity.name }
}
