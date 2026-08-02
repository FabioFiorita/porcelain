import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'

/**
 * Shell-side persistence for LOCAL terminal working directories.
 *
 * When a window is bound to a remote daemon, the human can still open a terminal on the
 * machine running the app — the Mac in front of them, to test an iOS build while the repo
 * lives on a Linux box. That terminal needs a cwd, and the remote repo's path usually
 * doesn't exist locally (`/home/you/code/app` vs `~/code/app`), so the human maps it once
 * and we remember it.
 *
 * It lives shell-side, in userData, for the same reason the environment list does: this is
 * a fact about THIS machine's filesystem, and the remote daemon — whose config is on the
 * other box — is the wrong place to record it. It's also why it can't go in the daemon's
 * per-repo config, which is keyed by a path on the daemon's own disk.
 *
 * Keyed by environment AND repo path: two machines commonly hold the same repo path, and
 * a bare path key would silently hand the Beelink's mapping to another host's identical
 * checkout. Nothing secret is stored here — just directory paths.
 */

const stateSchema = z.object({
  /** `<environmentId|local>\n<repoPath>` → the local directory to open a shell in. */
  paths: z.record(z.string(), z.string()),
})
export type LocalTerminalPathState = z.infer<typeof stateSchema>

const EMPTY_STATE: LocalTerminalPathState = { paths: {} }

const filePath = (): string => join(app.getPath('userData'), 'local-terminal-paths.json')

/**
 * The storage key for one mapping. PURE (exported for tests). A newline joins the parts
 * because it can't appear in an environment id or a filesystem path — a `:` separator
 * would collide with a Windows drive letter, and any path character risks two different
 * pairs colliding on one key.
 */
export function localTerminalPathKey(environmentId: string | null, repoPath: string): string {
  return `${environmentId ?? 'local'}\n${repoPath}`
}

/** Parse persisted JSON, falling back to empty on absent or corrupt shapes. PURE. */
export function parseLocalTerminalPathState(json: unknown): LocalTerminalPathState {
  const parsed = stateSchema.safeParse(json)
  return parsed.success ? parsed.data : EMPTY_STATE
}

/** The persisted state, or the empty state when the file is absent/corrupt. */
export async function loadLocalTerminalPaths(): Promise<LocalTerminalPathState> {
  let json: unknown
  try {
    json = JSON.parse(await readFile(filePath(), 'utf8'))
  } catch {
    // Absent file OR corrupt JSON — nothing usable either way, and a throw here would
    // break opening a terminal rather than just losing a remembered path.
    return EMPTY_STATE
  }
  return parseLocalTerminalPathState(json)
}

/** Persist the state (atomic tmp+rename, matching the repo's store style). */
async function saveLocalTerminalPaths(state: LocalTerminalPathState): Promise<void> {
  const path = filePath()
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
  await rename(tmp, path)
}

/**
 * Serialized read-modify-write — the only sanctioned way to change this file, same
 * discipline as `updateRemoteEnvironmentState`. Two windows mapping different repos at
 * once would otherwise lose one of the writes.
 */
let writeChain: Promise<void> = Promise.resolve()

export function updateLocalTerminalPaths(
  mutate: (state: LocalTerminalPathState) => LocalTerminalPathState,
): Promise<void> {
  const run = writeChain.then(async () => {
    await saveLocalTerminalPaths(mutate(await loadLocalTerminalPaths()))
  })
  writeChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
