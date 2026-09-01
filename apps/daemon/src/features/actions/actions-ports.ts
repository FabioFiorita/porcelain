import type { ActionsFileAction, ActionsFileV1 } from '@porcelain/shared/actions-file'

/** Expected store/adapter failure: host I/O or unusable document. */
export type ActionsUnavailableError = { code: 'actions.unavailable' }

export type ActionsNotFoundError = { code: 'actions.not-found'; actionId: string }

export type ActionsUntrustedError = { code: 'actions.untrusted'; actionId: string }

/** The caller named a checkout this Project does not own — refuse, never re-aim. */
export type ActionsTargetInvalidError = { code: 'actions.target-invalid'; actionId: string }

export type ActionsRequestInvalidError = { code: 'request.invalid' }

export type ActionsStoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ActionsUnavailableError }

export type ActionsChangeResult =
  | { ok: true; value: ActionsChange }
  | { ok: false; error: ActionsNotFoundError | ActionsRequestInvalidError }

/**
 * Durable mutation outcome after a successful atomic write. Carries the next file
 * snapshot plus the authoritative mutation payload for the calling operation.
 */
export type ActionsChange =
  | { kind: 'create'; file: ActionsFileV1; action: ActionsFileAction }
  | { kind: 'update'; file: ActionsFileV1; action: ActionsFileAction }
  | { kind: 'move'; file: ActionsFileV1; action: ActionsFileAction }
  | { kind: 'delete'; file: ActionsFileV1; actionId: string }

/** Outcome of a transactional mutation: durable success, domain reject, or adapter failure. */
export type ActionsTransactResult =
  | { ok: true; value: ActionsChange }
  | {
      ok: false
      error: ActionsUnavailableError | ActionsNotFoundError | ActionsRequestInvalidError
    }

/** Storage for one Project's saved commands, keyed by the stable Project id. */
export type ActionsStore = {
  read(projectId: string): Promise<ActionsStoreResult<ActionsFileV1>>
  transact(
    projectId: string,
    change: (current: ActionsFileV1) => ActionsChangeResult,
  ): Promise<ActionsTransactResult>
}

/**
 * Where a Project's Actions come from.
 *
 * Only `private` exists today: the daemon-root Project store, which is also the only
 * writable source. A second, read-only `tracked` source represents a promoted
 * repo-local `.porcelain/actions.json`. Listing already walks the source list in order
 * and lets the first source that claims an id win, so adding that source is a
 * composition change rather than a reshaping of the read path.
 */
export type ActionsSourceKind = 'private'

export type ActionsSource = {
  readonly kind: ActionsSourceKind
  readonly store: ActionsStore
}

/** Machine-local trust. Keys are stable Project ids. */
export type ActionTrustStore = {
  readFingerprints(projectId: string): Promise<ActionsStoreResult<ReadonlySet<string>>>
  trustCommands(projectId: string, commands: readonly string[]): Promise<ActionsStoreResult<void>>
}

/**
 * The narrow Projects capability Actions needs: which checkouts this Environment's
 * daemon currently knows for one Project. Actions never discovers Worktrees itself —
 * the Projects domain owns that truth, and a run target is checked against it.
 */
export type ActionsProjects = {
  listRunTargets(projectId: string): Promise<
    ActionsStoreResult<{
      readonly environmentId: string
      readonly worktrees: readonly { readonly id: string; readonly path: string }[]
    }>
  >
}

export type ActionsClock = { now(): number }
export type ActionsIds = { create(): string }

/** Domain-facing change fact. The publisher maps `type` onto the session `kind` wire. */
export type ActionsChanges = {
  publish(change: { type: 'actions.changed'; projectId: string }): void
}

export type ActionsOperationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      error:
        | ActionsUnavailableError
        | ActionsNotFoundError
        | ActionsUntrustedError
        | ActionsTargetInvalidError
        | ActionsRequestInvalidError
    }

export type ActionRecord = ActionsFileAction
