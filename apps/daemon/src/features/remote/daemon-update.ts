import { spawn } from 'node:child_process'

const NPM_LATEST = 'https://registry.npmjs.org/@fabiofiorita/porcelain/latest'

/**
 * True only for the always-on systemd unit. A development daemon and a foreground
 * `npx … serve` have no unit to restart, and restarting them would drop the process
 * the client is talking to with nothing to bring it back.
 */
export function daemonRestartable(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.PORCELAIN_DEV !== '1' &&
    typeof env.INVOCATION_ID === 'string' &&
    env.INVOCATION_ID.length > 0
  )
}

export async function fetchPublishedVersion(
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(NPM_LATEST, { signal: AbortSignal.timeout(8_000) })
    if (!response.ok) return null
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null || !('version' in body)) return null
    const version = (body as { version: unknown }).version
    return typeof version === 'string' && version.length > 0 ? version : null
  } catch {
    return null
  }
}

/** Resolve once systemctl has launched; systemd then takes over and terminates this daemon. */
export function restartPorcelainService(spawnImpl: typeof spawn = spawn): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnImpl('systemctl', ['--user', 'restart', 'porcelain.service'], {
      detached: true,
      stdio: 'ignore',
    })
    child.once('spawn', resolve)
    child.once('error', reject)
    child.unref()
  })
}
