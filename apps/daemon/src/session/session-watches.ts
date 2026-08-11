import { isAbsolute, relative, resolve, sep } from 'node:path'
import {
  SESSION_WATCH_INTEREST_LIMIT,
  type SessionWatchesFrame,
} from '@porcelain/contracts/session'

/**
 * One session's declarative watch interests: the complete set of files and directories a
 * connection wants observed, canonicalized, scoped to the project it declared, deduplicated,
 * and bounded before a single host watcher is created.
 *
 * Live-session hands accepted interests to `createSessionFilesWatches` through
 * `SessionWatchSink.apply`. Interests are advisory. Accepting one is a promise to *consider*
 * observing a path, never a promise to grow the daemon's watch scope on demand: a path outside
 * the declared project, a relative path, or anything past `SESSION_WATCH_INTEREST_LIMIT` is
 * refused here, before the watcher layer sees it. That is the point of putting the bound at
 * the boundary — a client cannot spend daemon file descriptors by asking harder.
 *
 * The bound follows the contract's own rule: keep the first interests, drop the extras. A
 * schema-level rejection of the whole frame would lose the registrations the client is
 * entitled to, not only the ones over the line. Files are kept before directories because an
 * open document's staleness is visible to the human immediately, while a stale tree is
 * covered by the existing tab-switch refresh.
 */

/** Why a single interest was refused. */
export type WatchInterestRejection = {
  readonly path: string
  readonly reason: 'not-absolute' | 'outside-project'
}

export type ResolvedWatchInterests = {
  /** The canonical project root every accepted interest is contained in. */
  readonly projectPath: string
  readonly files: readonly string[]
  readonly dirs: readonly string[]
  readonly rejected: readonly WatchInterestRejection[]
  /** How many otherwise-valid interests fell past the combined limit. */
  readonly droppedOverLimit: number
}

/** Expected outcomes; an unusable frame is ordinary client behavior, not a defect. */
export type ResolveWatchInterestsOutcome =
  | { ok: true; interests: ResolvedWatchInterests }
  | { ok: false; error: { code: 'session.invalid-project-path'; projectPath: string } }

/**
 * Canonicalize and bound one watch-interest frame.
 *
 * `resolve` collapses `.`, `..`, and duplicate separators so containment is decided on a real
 * path rather than on the string a client happened to send: `/repo/../etc/shadow` becomes
 * `/etc/shadow` and is refused, and `/repo/src/../src/a.ts` deduplicates against
 * `/repo/src/a.ts` instead of registering twice. Containment is decided with `relative`, which
 * cannot be fooled by a sibling directory sharing a prefix (`/repo-other` is not in `/repo`).
 */
export function resolveSessionWatchInterests(
  frame: SessionWatchesFrame,
): ResolveWatchInterestsOutcome {
  if (!isAbsolute(frame.projectPath)) {
    return {
      ok: false,
      error: { code: 'session.invalid-project-path', projectPath: frame.projectPath },
    }
  }
  const projectPath = resolve(frame.projectPath)

  const rejected: WatchInterestRejection[] = []
  const accept = (paths: readonly string[]): string[] => {
    const kept: string[] = []
    const seen = new Set<string>()
    for (const path of paths) {
      if (!isAbsolute(path)) {
        rejected.push({ path, reason: 'not-absolute' })
        continue
      }
      const canonical = resolve(path)
      const within = relative(projectPath, canonical)
      // '' is the project root itself; anything that has to climb out of it, or resolves to
      // another root entirely, is outside the scope this session declared.
      if (within === '..' || within.startsWith(`..${sep}`) || isAbsolute(within)) {
        rejected.push({ path, reason: 'outside-project' })
        continue
      }
      if (seen.has(canonical)) continue
      seen.add(canonical)
      kept.push(canonical)
    }
    return kept
  }

  const files = accept(frame.files)
  const dirs = accept(frame.dirs)

  const boundedFiles = files.slice(0, SESSION_WATCH_INTEREST_LIMIT)
  const boundedDirs = dirs.slice(0, Math.max(SESSION_WATCH_INTEREST_LIMIT - boundedFiles.length, 0))
  const droppedOverLimit = files.length - boundedFiles.length + (dirs.length - boundedDirs.length)

  return {
    ok: true,
    interests: { projectPath, files: boundedFiles, dirs: boundedDirs, rejected, droppedOverLimit },
  }
}

/**
 * Where accepted interests are applied. One complete desired set per call so project identity
 * never races install; the Files watcher receives projectPath + files + dirs together.
 */
export type SessionWatchSink = {
  /**
   * Apply one complete desired set for this session. Idempotent reconcile.
   * `files` / `dirs` are already canonical absolute paths inside `projectPath`.
   */
  readonly apply: (interests: {
    readonly projectPath: string
    readonly files: readonly string[]
    readonly dirs: readonly string[]
  }) => void
  /** Release every watcher this session owns. */
  readonly clear: () => void
}

export type SessionWatchInterests = {
  /** Apply a complete desired set. Idempotent: re-sending the same frame is a no-op reconcile. */
  readonly register: (frame: SessionWatchesFrame) => ResolveWatchInterestsOutcome
  /** The interests currently applied, or `undefined` before the first accepted registration. */
  readonly current: () => ResolvedWatchInterests | undefined
  /**
   * Session close. Preserves today's dispose behavior — the session's watchers are released
   * while everything else it touched (PTYs) stays daemon-owned. Idempotent.
   */
  readonly clear: () => void
}

export function createSessionWatchInterests(sink: SessionWatchSink): SessionWatchInterests {
  let applied: ResolvedWatchInterests | undefined

  return {
    register(frame) {
      const outcome = resolveSessionWatchInterests(frame)
      if (!outcome.ok) return outcome
      applied = outcome.interests
      sink.apply({
        projectPath: outcome.interests.projectPath,
        files: outcome.interests.files,
        dirs: outcome.interests.dirs,
      })
      return outcome
    },
    current() {
      return applied
    },
    clear() {
      applied = undefined
      sink.clear()
    },
  }
}
