import {
  SESSION_WATCH_INTEREST_LIMIT,
  type SessionWatchesFrame,
  sessionWatchesFrameSchema,
} from '@porcelain/contracts/session'

/**
 * The client half of declarative watch interests: many consumers each declaring the files and
 * directories they need observed, combined into the one complete desired set a session may
 * send.
 *
 * Reference counting is the point (decision 009). Two screens can hold the same open document,
 * and one of them closing must not silently unwatch it for the other, so an interest lives as
 * long as any registration holds it rather than as long as the last writer says so. The result
 * is a set, not a delta: re-sending it after a reconnect is the same message as the first
 * registration.
 *
 * Bounding happens here, before the frame is built, and follows the daemon's own rule
 * (`apps/daemon/src/session/session-watches.ts`): keep the first interests, drop the extras,
 * files before directories. A client that asks for more than the daemon will grant learns
 * nothing by asking — it just loses the interests past the line — so it is cheaper to submit a
 * set the daemon can accept whole and to know how many were dropped. The ceiling is
 * `SESSION_WATCH_INTEREST_LIMIT` from the contract, never a transcribed literal: the daemon and
 * the client must not be able to disagree about it.
 *
 * Nothing here knows about sockets, projects, or readiness. `client-runtime.ts` owns when a
 * desired set is allowed to reach the wire.
 */

/** One consumer's declared interest. Paths are passed through untouched — the daemon canonicalizes. */
export type WatchInterest = {
  readonly files: readonly string[]
  readonly dirs: readonly string[]
}

/** The combined desired set, deduplicated and bounded to what the daemon will accept. */
export type BoundedWatchInterests = {
  readonly files: readonly string[]
  readonly dirs: readonly string[]
  /** How many otherwise-valid interests fell past the combined limit and were not submitted. */
  readonly droppedOverLimit: number
}

/** A consumer's handle on its own registration. `release` is idempotent. */
export type WatchInterestRegistration = {
  readonly release: () => void
}

export type WatchInterestRegistry = {
  /** Declare an interest; it is held until the returned registration is released. */
  readonly register: (interest: WatchInterest) => WatchInterestRegistration
  /** The complete desired set right now, deduplicated and bounded. */
  readonly desired: () => BoundedWatchInterests
  /** How many registrations are currently held. */
  readonly registrationCount: () => number
}

const EMPTY_INTERESTS: BoundedWatchInterests = { files: [], dirs: [], droppedOverLimit: 0 }

/**
 * Combine registrations into one bounded desired set.
 *
 * Deduplication preserves first-declared order so the bound is predictable: the interests a
 * client declared earliest are the ones it keeps. Files are kept before directories because an
 * open document going stale is visible to the human immediately, while a stale tree is covered
 * by the existing refresh on navigation.
 */
export function boundWatchInterests(interests: Iterable<WatchInterest>): BoundedWatchInterests {
  const files: string[] = []
  const dirs: string[] = []
  const seenFiles = new Set<string>()
  const seenDirs = new Set<string>()

  for (const interest of interests) {
    for (const path of interest.files) {
      if (seenFiles.has(path)) continue
      seenFiles.add(path)
      files.push(path)
    }
    for (const path of interest.dirs) {
      if (seenDirs.has(path)) continue
      seenDirs.add(path)
      dirs.push(path)
    }
  }

  const boundedFiles = files.slice(0, SESSION_WATCH_INTEREST_LIMIT)
  const boundedDirs = dirs.slice(0, Math.max(SESSION_WATCH_INTEREST_LIMIT - boundedFiles.length, 0))

  return {
    files: boundedFiles,
    dirs: boundedDirs,
    droppedOverLimit: files.length - boundedFiles.length + (dirs.length - boundedDirs.length),
  }
}

export function createWatchInterestRegistry(): WatchInterestRegistry {
  // Identity, not value, is the registration: two consumers declaring the same paths are two
  // holders, and one releasing must leave the other's interest standing.
  const held = new Set<WatchInterest>()

  return {
    register(interest) {
      const entry: WatchInterest = { files: [...interest.files], dirs: [...interest.dirs] }
      held.add(entry)
      return {
        release() {
          held.delete(entry)
        },
      }
    },

    desired() {
      return held.size === 0 ? EMPTY_INTERESTS : boundWatchInterests(held)
    },

    registrationCount() {
      return held.size
    },
  }
}

/**
 * Build the outbound registration frame for a project.
 *
 * Parsed through the contract on the way out: the client proves it still honors the wire shape
 * it agreed to rather than trusting a TypeScript type. An empty desired set is a legitimate
 * frame — it declares "this session watches nothing in this project", which is what clears the
 * daemon's watchers for it.
 */
export function watchesFrameFor({
  projectPath,
  interests,
}: {
  projectPath: string
  interests: BoundedWatchInterests
}): SessionWatchesFrame {
  return sessionWatchesFrameSchema.parse({
    t: 'session:watches',
    projectPath,
    files: [...interests.files],
    dirs: [...interests.dirs],
  })
}
