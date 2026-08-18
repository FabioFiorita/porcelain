import { realpathSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { configuredHubInventoryStore, configuredProjectsRecentsStore } from './features/projects'

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
/**
 * Return the canonical path when a path belongs to the disposable playground family.
 *
 * The string form matters at the project-operation boundary: callers must inspect, warm, and
 * register the same canonical path they just authorized. A boolean-only check leaves a symlink
 * race between validation and the first filesystem operation.
 *
 * `realpathSync.native`, not plain `realpathSync`, for every comparison side below: the daemon's
 * own project registration (hub-git-port.ts) resolves through `node:fs/promises`' `realpath`,
 * libuv-backed and case-correcting. Node's default sync `realpathSync` is a pure-JS shim that
 * preserves whatever casing the caller passed. On a case-insensitive volume (macOS, Windows) a
 * path browsed through the UI (built from the true on-disk directory names) and the same path
 * built from a lower-cased constant (`devRepoPath`'s default) can disagree on casing for the
 * identical directory — with the non-native form, the `relative()` containment check below then
 * sees two "different" roots and rejects a playground the daemon already recognizes.
 */
export function recognizedDevPlaygroundPath(path: string, primaryPath: string): string | null {
  // Canonicalize both sides before applying containment. A lexical check alone lets a symlink
  // inside the playground point at a production checkout. Missing paths are valid inputs while
  // opening a project (the operation will report `not-found`); canonicalize their deepest
  // existing ancestor and append the still-missing suffix so this guard remains synchronous and
  // fail-closed without turning a normal missing-path response into an exception.
  const canonical = (value: string): string | null => {
    const lexical = resolve(value)
    let cursor = lexical
    const suffix: string[] = []
    while (true) {
      try {
        const root = realpathSync.native(cursor)
        return suffix.length === 0 ? root : resolve(root, ...suffix.reverse())
      } catch {
        const parent = dirname(cursor)
        if (parent === cursor) return null
        suffix.push(basename(cursor))
        cursor = parent
      }
    }
  }

  const candidate = canonical(path)
  const primary = canonical(primaryPath)
  if (candidate === null || primary === null) return null
  // The configured primary playground is itself a managed root. Existing symlinks here would
  // make the apparent dev home point at an arbitrary checkout, so reject them instead of
  // treating their canonical target as the sandbox. Deliberately plain (non-native)
  // realpathSync: this compares two resolutions of the SAME input string, so case-correction
  // would just make a same-casing path look like a symlink on a case-insensitive volume.
  try {
    if (realpathSync(resolve(primaryPath)) !== resolve(primaryPath)) return null
  } catch {
    // Missing primary paths are valid during first-run setup; their canonical ancestors were
    // already checked above.
  }
  if (candidate === primary) return candidate

  const primaryParent = dirname(primary)
  const managedRoots = [
    basename(primaryParent) === 'porcelain-playgrounds'
      ? primaryParent
      : join(primaryParent, 'porcelain-playgrounds'),
    // Hub-created Worktrees use the Git adapter's sibling convention, while
    // managed worktrees use the plural playground root.
    basename(primaryParent) === 'porcelain-playground-worktrees'
      ? primaryParent
      : join(primaryParent, 'porcelain-playground-worktrees'),
  ]
  for (const managedRoot of managedRoots) {
    // A managed root is itself a trust boundary. If the root is a symlink, accepting its
    // canonical target would silently turn a dev root into an arbitrary host directory.
    let canonicalRoot: string
    try {
      canonicalRoot = realpathSync.native(managedRoot)
    } catch {
      // A managed root is allowed to be created later. In that case its existing ancestors must
      // already be canonical; `canonical` preserves the lexical missing suffix for this check.
      const unresolved = canonical(managedRoot)
      if (unresolved === null || unresolved !== resolve(managedRoot)) continue
      canonicalRoot = unresolved
    }
    if (resolve(managedRoot) !== canonicalRoot) continue
    const withinManagedRoot = relative(canonicalRoot, candidate)
    if (
      withinManagedRoot !== '' &&
      !isAbsolute(withinManagedRoot) &&
      withinManagedRoot !== '..' &&
      !withinManagedRoot.startsWith(`..${sep}`)
    ) {
      return candidate
    }
  }
  return null
}

export function isRecognizedDevPlayground(path: string, primaryPath: string): boolean {
  return recognizedDevPlaygroundPath(path, primaryPath) !== null
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
  const inventory = configuredHubInventoryStore()
  const stored = await inventory.readProjects()
  if (stored.ok) {
    const filtered = stored.value.filter(
      (project) =>
        isRecognizedDevPlayground(project.commonGitDir, devRepo) ||
        isRecognizedDevPlayground(dirname(project.commonGitDir), devRepo),
    )
    if (filtered.length !== stored.value.length) await inventory.writeProjects(filtered)
  }
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
