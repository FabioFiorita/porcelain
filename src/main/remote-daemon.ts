import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'

/**
 * Shell-side persistence for SAVED remote environments (remote-envs Phase 4).
 *
 * The shell owns which daemon every window talks to, so the choice CANNOT live
 * in the daemon's own config (that config lives on whichever machine the daemon
 * runs on — circular). It's a small file, `remote-daemon.json`, in the shell's
 * userData dir: a list of named `{ id, name, url, token }` environments plus the
 * `activeId` of the one this app is currently pointed at (null = the local child).
 *
 * The tokens are stored in plaintext. That's the same trust level as
 * `~/.porcelain/daemon-token` (the local daemon's own token file): a
 * user-owned dir, and each secret only gates a daemon the user themselves pointed
 * this app at. Never log them.
 */

const environmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  token: z.string(),
})
export type RemoteEnvironment = z.infer<typeof environmentSchema>

const stateSchema = z.object({
  activeId: z.string().nullable(),
  environments: z.array(environmentSchema),
})
export type RemoteEnvironmentState = z.infer<typeof stateSchema>

/** The resolved daemon pair the daemon module points every window at. */
export type RemoteDaemon = { url: string; token: string }

// The pre-list shape: a single `{ url, token }` override meant "connected to
// exactly this daemon". Kept only so an existing file migrates forward once.
const legacySchema = z.object({ url: z.string(), token: z.string() })

const EMPTY_STATE: RemoteEnvironmentState = { activeId: null, environments: [] }

const filePath = (): string => join(app.getPath('userData'), 'remote-daemon.json')

/**
 * Parse persisted JSON into the v2 state. PURE (exported for tests): tries the v2
 * schema first; failing that, migrates a legacy `{ url, token }` override into one
 * ACTIVE environment (preserving today's "a persisted override means connected"
 * behavior); anything else falls back to the empty state.
 */
export function parseRemoteEnvironmentState(json: unknown): RemoteEnvironmentState {
  const v2 = stateSchema.safeParse(json)
  if (v2.success) return v2.data

  const legacy = legacySchema.safeParse(json)
  if (legacy.success) {
    const { url, token } = legacy.data
    let name = url
    try {
      name = new URL(url).hostname || url
    } catch {
      // Not a parseable URL — the raw string is still a fine display name.
    }
    return { activeId: 'legacy', environments: [{ id: 'legacy', name, url, token }] }
  }

  return EMPTY_STATE
}

/** The persisted state, or the empty state when the file is absent/corrupt. */
export async function loadRemoteEnvironmentState(): Promise<RemoteEnvironmentState> {
  let json: unknown
  try {
    json = JSON.parse(await readFile(filePath(), 'utf8'))
  } catch {
    // Absent file OR corrupt JSON — either way there is nothing usable, and this
    // runs at startup where a throw would take the shell down.
    return EMPTY_STATE
  }
  return parseRemoteEnvironmentState(json)
}

/** Persist the state (atomic tmp+rename, matching the repo's store style). */
export async function saveRemoteEnvironmentState(state: RemoteEnvironmentState): Promise<void> {
  const path = filePath()
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
  await rename(tmp, path)
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
