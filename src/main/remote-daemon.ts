import { readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'

/**
 * Shell-side persistence for a REMOTE daemon override (remote-envs Phase 4).
 *
 * The shell owns which daemon every window talks to, so the choice CANNOT live
 * in the daemon's own config (that config lives on whichever machine the daemon
 * runs on — circular). It's a small file, `remote-daemon.json`, in the shell's
 * userData dir: `{ url, token }` when an override is set, absent otherwise.
 *
 * The token is stored in plaintext. That's the same trust level as
 * `~/.porcelain/daemon-token` (the local daemon's own token file): a
 * user-owned dir, and the secret only gates a daemon the user themselves pointed
 * this app at. Never log it.
 */

const remoteDaemonSchema = z.object({ url: z.string(), token: z.string() })
export type RemoteDaemon = z.infer<typeof remoteDaemonSchema>

const filePath = (): string => join(app.getPath('userData'), 'remote-daemon.json')

/** The persisted remote override, or null when none is set (absent/corrupt file). */
export async function loadRemoteDaemon(): Promise<RemoteDaemon | null> {
  let json: unknown
  try {
    json = JSON.parse(await readFile(filePath(), 'utf8'))
  } catch {
    // Absent file OR corrupt JSON — either way there is no usable override,
    // and this runs at startup where a throw would take the shell down.
    return null
  }
  const parsed = remoteDaemonSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

/** Persist the remote override (atomic tmp+rename, matching the repo's store style). */
export async function saveRemoteDaemon(value: RemoteDaemon): Promise<void> {
  const path = filePath()
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await rename(tmp, path)
}

/** Delete the remote override file (no-op if it's already absent). */
export async function deleteRemoteDaemon(): Promise<void> {
  await unlink(filePath()).catch(() => {})
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
