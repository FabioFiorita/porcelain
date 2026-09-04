import { isDeepStrictEqual } from 'node:util'
import { type HubInventory, hubInventorySchema } from '@porcelain/contracts/projects'
import { createTRPCUntypedClient, httpLink } from '@trpc/client'
import { z } from 'zod'
import { localDaemonPair } from './daemon'
import { daemonHeaders } from './daemon-headers'
import { loadRemoteEnvironmentState, type RemoteEnvironment } from './remote-daemon'
import { liveEndpoint, probeEnvironment } from './shell-environments'
import { loadShellHubInventoryCache, saveShellHubInventoryCache } from './shell-hub-inventory-cache'

/** One validated inventory plus the shell identity needed to route its actions safely. */
export type ShellHubInventory = Readonly<{
  /** null = This device; otherwise the shell's saved environment-group id. */
  environmentId: string | null
  /** Whether this inventory belongs to the environment bound to the calling window. */
  current: boolean
  /** Last successful metadata shown while the owning daemon cannot be reached. */
  offline: boolean
  inventory: HubInventory
}>

const shellHubInventorySchema = z
  .object({
    environmentId: z.string().nullable(),
    current: z.boolean(),
    offline: z.boolean(),
    inventory: hubInventorySchema,
  })
  .strict()

/**
 * Read one already-probed daemon inventory. The fan-out is a main-process read: this path
 * never puts the credential in the response. A renderer that needs its OWN session to that
 * Environment asks for one explicitly (`environmentConnections` in shell-environments.ts).
 */
async function readHubInventory(url: string, token: string): Promise<HubInventory | null> {
  try {
    const client = createTRPCUntypedClient({
      links: [
        httpLink({
          url: `${url}/trpc`,
          headers: daemonHeaders(token),
        }),
      ],
    })
    return hubInventorySchema.parse(await client.query('hubInventory'))
  } catch {
    // A daemon can disappear between the identity probe and the inventory read. The live Hub
    // omits that Environment instead of showing stale children or surfacing a shell error.
    return null
  }
}

async function readLocalHubInventory(current: boolean): Promise<ShellHubInventory | null> {
  const local = localDaemonPair()
  if (local.url === '' || (await probeEnvironment(local.url, local.token)).state !== 'online')
    return null
  const inventory = await readHubInventory(local.url, local.token)
  if (inventory === null) return null
  return shellHubInventorySchema.parse({
    environmentId: null,
    current,
    offline: false,
    inventory: {
      ...inventory,
      // Keep the local authority (`environmentId: null`) while preserving the name its daemon
      // owns. A nickname must not turn This device into a synthetic remote group.
      environment: inventory.environment,
    },
  })
}

async function readRemoteHubInventory(
  env: RemoteEnvironment,
  currentEnvironmentId: string | null,
): Promise<ShellHubInventory | null> {
  const endpoint = await liveEndpoint(env)
  if (endpoint === null) return null
  const inventory = await readHubInventory(endpoint, env.token)
  if (inventory === null) return null
  return shellHubInventorySchema.parse({
    environmentId: env.id,
    current: currentEnvironmentId === env.id,
    offline: false,
    inventory,
  })
}

/**
 * Read This device and every saved Environment concurrently. A remote that has answered before
 * remains as a clearly stale/offline directory while it sleeps; only a successful remote read
 * replaces its atomically persisted metadata.
 */
export async function readHubInventories(
  currentEnvironmentId: string | null,
): Promise<readonly ShellHubInventory[]> {
  const state = await loadRemoteEnvironmentState()
  const [cached, local, ...remote] = await Promise.all([
    loadShellHubInventoryCache(),
    readLocalHubInventory(currentEnvironmentId === null),
    ...state.environments.map((env) => readRemoteHubInventory(env, currentEnvironmentId)),
  ])
  const nextCache = { ...cached }
  let changed = false
  const remembered = remote.flatMap((source, index) => {
    const environment = state.environments[index]
    if (environment === undefined) return []
    if (source !== null) {
      if (!isDeepStrictEqual(nextCache[environment.id], source.inventory)) {
        nextCache[environment.id] = source.inventory
        changed = true
      }
      return [source]
    }
    const inventory = cached[environment.id]
    return inventory === undefined
      ? []
      : [
          shellHubInventorySchema.parse({
            environmentId: environment.id,
            current: currentEnvironmentId === environment.id,
            offline: true,
            inventory,
          }),
        ]
  })
  // Drop snapshots for environments the human removed. They are no longer in scope and should
  // not be revived by a later pairing that happens to reuse a display name.
  const known = new Set(state.environments.map((environment) => environment.id))
  for (const id of Object.keys(nextCache)) {
    if (!known.has(id)) {
      delete nextCache[id]
      changed = true
    }
  }
  if (changed) {
    try {
      await saveShellHubInventoryCache(nextCache)
    } catch (error) {
      // This cache is only offline presentation recovery. A disk or permission failure must not
      // hide live Environments that were already read successfully.
      console.error('[hub] could not persist the offline inventory cache:', error)
    }
  }
  return [local, ...remembered].flatMap((source) => (source === null ? [] : [source]))
}

/**
 * Read only the inventory bound to one window. Unlike `readHubInventories`, this deliberately
 * does not inspect every saved Environment: mutations on the current daemon use it to refresh
 * that window's Hub row without making a local interaction wait on an unrelated remote probe.
 */
export async function readCurrentHubInventory(
  currentEnvironmentId: string | null,
): Promise<ShellHubInventory | null> {
  if (currentEnvironmentId === null) return readLocalHubInventory(true)
  const state = await loadRemoteEnvironmentState()
  const environment = state.environments.find((entry) => entry.id === currentEnvironmentId)
  return environment === undefined
    ? null
    : readRemoteHubInventory(environment, currentEnvironmentId)
}
