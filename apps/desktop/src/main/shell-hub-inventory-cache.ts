import { chmod, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type HubInventory, hubInventorySchema } from '@porcelain/contracts/projects'
import { app } from 'electron'
import { z } from 'zod'

/**
 * Last successful, non-secret remote Hub metadata. This is presentation recovery data only:
 * it intentionally excludes paired credentials, endpoints, and any action result. A sleeping
 * Environment can therefore remain navigable as an explicitly offline directory until it
 * comes back and replaces this snapshot.
 */
const stateSchema = z
  .object({
    version: z.literal(1),
    inventories: z.record(z.string().min(1), hubInventorySchema),
  })
  .strict()

export type ShellHubInventoryCache = Readonly<Record<string, HubInventory>>

const pathForCache = (): string => join(app.getPath('userData'), 'hub-inventory-cache.json')
let saveCounter = 0

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

/** A missing or obsolete cache is disposable; it must never stop the live Hub from loading. */
export async function loadShellHubInventoryCache(): Promise<ShellHubInventoryCache> {
  try {
    const raw = await readFile(pathForCache(), 'utf8')
    return stateSchema.parse(JSON.parse(raw)).inventories
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return {}
    return {}
  }
}

/** Atomically replace the cache, keeping it private on POSIX where modes are meaningful. */
export async function saveShellHubInventoryCache(
  inventories: ShellHubInventoryCache,
): Promise<void> {
  const path = pathForCache()
  const tmp = `${path}.tmp-${process.pid}-${++saveCounter}`
  try {
    await writeFile(tmp, JSON.stringify({ version: 1, inventories }, null, 2), {
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
