import { type HubInventory, hubInventorySchema } from '@porcelain/contracts/projects'
import { createTRPCUntypedClient, httpLink } from '@trpc/client'
import { z } from 'zod'
import { localDaemonPair } from './daemon'
import { daemonHeaders } from './daemon-headers'
import { loadRemoteEnvironmentState, type RemoteEnvironment } from './remote-daemon'
import { liveEndpoint, probeEnvironment } from './shell-environments'

/** One validated inventory plus the shell identity needed to route its actions safely. */
export type ShellHubInventory = Readonly<{
  /** null = This device; otherwise the shell's saved environment-group id. */
  environmentId: string | null
  /** Whether this inventory belongs to the environment bound to the calling window. */
  current: boolean
  inventory: HubInventory
}>

const shellHubInventorySchema = z
  .object({
    environmentId: z.string().nullable(),
    current: z.boolean(),
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
  return shellHubInventorySchema.parse({ environmentId: null, current, inventory })
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
    inventory,
  })
}

/** Read This device and every saved Environment concurrently; failed sources are omitted. */
export async function readHubInventories(
  currentEnvironmentId: string | null,
): Promise<readonly ShellHubInventory[]> {
  const state = await loadRemoteEnvironmentState()
  const [local, ...remote] = await Promise.all([
    readLocalHubInventory(currentEnvironmentId === null),
    ...state.environments.map((env) => readRemoteHubInventory(env, currentEnvironmentId)),
  ])
  return [local, ...remote].flatMap((source) => (source === null ? [] : [source]))
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
