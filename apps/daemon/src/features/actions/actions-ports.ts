import type { ActionsFileAction, ActionsFileV1 } from '@porcelain/shared/actions-file'

/** Expected store/adapter failure: host I/O or unusable document. */
export type ActionsUnavailableError = { code: 'actions.unavailable' }

export type ActionsNotFoundError = { code: 'actions.not-found'; actionId: string }

export type ActionsUntrustedError = { code: 'actions.untrusted'; actionId: string }

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

export type ActionsStore = {
  read(projectPath: string): Promise<ActionsStoreResult<ActionsFileV1>>
  transact(
    projectPath: string,
    change: (current: ActionsFileV1) => ActionsChangeResult,
  ): Promise<ActionsTransactResult>
}

/** Machine-local trust. Keys are absolute project paths. */
export type ActionTrustStore = {
  readFingerprints(projectPath: string): Promise<ActionsStoreResult<ReadonlySet<string>>>
  trustCommands(projectPath: string, commands: readonly string[]): Promise<ActionsStoreResult<void>>
}

export type ActionsClock = { now(): number }
export type ActionsIds = { create(): string }

/** Domain-facing change fact. The publisher maps `type` onto the RT-001 `kind` wire. */
export type ActionsChanges = {
  publish(change: { type: 'actions.changed'; projectPath: string }): void
}

export type ActionsOperationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      error:
        | ActionsUnavailableError
        | ActionsNotFoundError
        | ActionsUntrustedError
        | ActionsRequestInvalidError
    }

export type ActionRecord = ActionsFileAction
