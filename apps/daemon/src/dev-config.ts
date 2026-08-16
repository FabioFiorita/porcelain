import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { configuredProjectsRecentsStore } from './features/projects'

export function devRepoPath(source: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  return source.PORCELAIN_DEV_PLAYGROUND ?? join(home, 'code', 'porcelain-playground')
}

/**
 * Dev recents are deliberately narrower than production recents: an agent may
 * freely mutate a playground, but must never receive a real checkout from the
 * developer's machine through the dev daemon. Managed worktree playgrounds
 * share the `porcelain-playgrounds` parent; the primary profile uses the
 * singular `porcelain-playground` path.
 */
export function isRecognizedDevPlayground(path: string, primaryPath: string): boolean {
  const candidate = resolve(path)
  const primary = resolve(primaryPath)
  if (candidate === primary) return true

  const primaryParent = dirname(primary)
  const managedRoot =
    basename(primaryParent) === 'porcelain-playgrounds'
      ? primaryParent
      : join(primaryParent, 'porcelain-playgrounds')
  const withinManagedRoot = relative(managedRoot, candidate)
  return (
    withinManagedRoot !== '' &&
    !isAbsolute(withinManagedRoot) &&
    withinManagedRoot !== '..' &&
    !withinManagedRoot.startsWith(`..${sep}`)
  )
}

/**
 * First run of `pnpm dev` starts with an empty dev config; seed it with the
 * playground repo so dev sessions never open the user's real work repos.
 */
export async function seedDevConfig(
  source: NodeJS.ProcessEnv = process.env,
  home = homedir(),
): Promise<void> {
  const devRepo = devRepoPath(source, home)
  const recents = configuredProjectsRecentsStore()
  const current = await recents.readPaths()
  if (!current.ok) return

  // The dev daemon may have been started after a user manually added a real
  // checkout. Prune only the registration; never touch the repository itself.
  for (const path of current.value) {
    if (isRecognizedDevPlayground(path, devRepo)) continue
    await recents.removePath(path)
  }

  try {
    await stat(devRepo)
  } catch {
    return
  }
  const afterCleanup = await recents.readPaths()
  if (!afterCleanup.ok || afterCleanup.value.length > 0) return
  await recents.addPath(devRepo)
}
