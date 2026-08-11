import type { BoardFileCard, BoardFileStatus, BoardFileV1 } from '@porcelain/shared/board-file'

/** Expected store/adapter failure: host I/O or unusable document. */
export type BoardUnavailableError = { code: 'board.unavailable' }

export type BoardCardNotFoundError = { code: 'board.card-not-found'; cardId: string }

export type BoardInvalidTitleError = {
  code: 'board.invalid-title'
  reason: 'blank' | 'too-long'
  maxLength: 240
}

export type BoardStoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: BoardUnavailableError }

export type BoardChangeResult =
  | { ok: true; value: BoardChange }
  | { ok: false; error: BoardCardNotFoundError | BoardInvalidTitleError }

/**
 * Durable mutation outcome after a successful atomic write. Carries the next file
 * snapshot plus the authoritative mutation payload for the calling operation.
 */
export type BoardChange =
  | { kind: 'create'; file: BoardFileV1; card: BoardFileCard }
  | { kind: 'update'; file: BoardFileV1; card: BoardFileCard }
  | { kind: 'move'; file: BoardFileV1; card: BoardFileCard }
  | { kind: 'delete'; file: BoardFileV1; cardId: string }
  | { kind: 'clear'; file: BoardFileV1; status: BoardFileStatus; cardIds: string[] }

/** Outcome of a transactional mutation: durable success, domain reject, or adapter failure. */
export type BoardTransactResult =
  | { ok: true; value: BoardChange }
  | {
      ok: false
      error: BoardUnavailableError | BoardCardNotFoundError | BoardInvalidTitleError
    }

export type BoardStore = {
  read(projectPath: string): Promise<BoardStoreResult<BoardFileV1>>
  transact(
    projectPath: string,
    change: (current: BoardFileV1) => BoardChangeResult,
  ): Promise<BoardTransactResult>
}

export type BoardClock = { now(): number }
export type BoardIds = { create(): string }

/** Domain-facing change fact. The publisher maps `type` onto the RT-001 `kind` wire. */
export type BoardChanges = {
  publish(change: { type: 'board.changed'; projectPath: string }): void
}

export type BoardOperationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      error: BoardUnavailableError | BoardCardNotFoundError | BoardInvalidTitleError
    }

export type BoardCard = BoardFileCard
export type BoardStatus = BoardFileStatus
