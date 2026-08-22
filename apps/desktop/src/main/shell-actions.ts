import { type ActionView, actionsProcedures } from '@porcelain/contracts/actions'
import { createTRPCUntypedClient, httpLink } from '@trpc/client'
import { localDaemonPair } from './daemon'
import { daemonHeaders } from './daemon-headers'
import { loadRemoteEnvironmentState } from './remote-daemon'
import { liveEndpoint, probeEnvironment } from './shell-environments'

/**
 * Read one Project's saved commands from an Environment this window is NOT bound to.
 *
 * The renderer can only reach its own daemon, so the Hub's Actions menu would otherwise
 * be blind to the same Project living on a second machine (#24). This is a read: running
 * still happens on the Environment that owns the checkout, and the token never leaves
 * the main process.
 */

/** `null` groupId is This device; anything else is a saved environment group. */
async function resolveEndpoint(
  groupId: string | null,
): Promise<{ url: string; token: string } | null> {
  if (groupId === null) {
    const local = localDaemonPair()
    if (local.url === '') return null
    const { state } = await probeEnvironment(local.url, local.token)
    return state === 'online' ? local : null
  }
  const env = (await loadRemoteEnvironmentState()).environments.find(
    (entry) => entry.id === groupId,
  )
  if (env === undefined) return null
  const url = await liveEndpoint(env)
  return url === null ? null : { url, token: env.token }
}

/**
 * Saved commands for one Project on one Environment. An Environment that went offline
 * between the inventory read and this call yields an empty list — the live Hub omits
 * what it cannot currently reach rather than showing stale commands as runnable.
 */
export async function readProjectActions(input: {
  groupId: string | null
  projectId: string
}): Promise<readonly ActionView[]> {
  const endpoint = await resolveEndpoint(input.groupId)
  if (endpoint === null) return []
  try {
    const client = createTRPCUntypedClient({
      links: [
        httpLink({
          url: `${endpoint.url}/trpc`,
          headers: daemonHeaders(endpoint.token),
        }),
      ],
    })
    return actionsProcedures.actions.output.parse(
      await client.query('actions', { projectId: input.projectId }),
    )
  } catch {
    return []
  }
}
