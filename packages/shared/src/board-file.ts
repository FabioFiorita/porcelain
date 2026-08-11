/**
 * Strict version-1 Board file model — shared by the daemon adapter and the dependency-free CLI.
 * No Zod, no Node APIs beyond what callers supply: pure parse, serialize, and card transitions.
 */

export const BOARD_FILE_VERSION = 1 as const

export const BOARD_FILE_STATUSES = ['todo', 'doing', 'done'] as const
export type BoardFileStatus = (typeof BOARD_FILE_STATUSES)[number]

export const BOARD_TITLE_MAX_LENGTH = 240
export const BOARD_BODY_MAX_LENGTH = 20_000

export type BoardFileCard = {
  id: string
  title: string
  body?: string
  status: BoardFileStatus
  order: number
  createdAt: number
}

export type BoardFileV1 = {
  version: typeof BOARD_FILE_VERSION
  cards: BoardFileCard[]
}

export type BoardFileParseErrorCode =
  | 'incompatible-version'
  | 'malformed'
  | 'duplicate-id'
  | 'invalid-card'

export class BoardFileParseError extends Error {
  readonly code: BoardFileParseErrorCode

  constructor(code: BoardFileParseErrorCode, message: string) {
    super(message)
    this.name = 'BoardFileParseError'
    this.code = code
  }
}

export type BoardTitleError = {
  code: 'board.invalid-title'
  reason: 'blank' | 'too-long'
  maxLength: typeof BOARD_TITLE_MAX_LENGTH
}

export type BoardCardNotFoundError = {
  code: 'board.card-not-found'
  cardId: string
}

const STATUS_SET = new Set<string>(BOARD_FILE_STATUSES)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function emptyBoardFileV1(): BoardFileV1 {
  return { version: BOARD_FILE_VERSION, cards: [] }
}

export function normalizeBoardTitle(
  title: string,
): { ok: true; title: string } | { ok: false; error: BoardTitleError } {
  const trimmed = title.trim()
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: {
        code: 'board.invalid-title',
        reason: 'blank',
        maxLength: BOARD_TITLE_MAX_LENGTH,
      },
    }
  }
  if (trimmed.length > BOARD_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: {
        code: 'board.invalid-title',
        reason: 'too-long',
        maxLength: BOARD_TITLE_MAX_LENGTH,
      },
    }
  }
  return { ok: true, title: trimmed }
}

function parseCard(value: unknown, index: number): BoardFileCard {
  if (!isRecord(value)) {
    throw new BoardFileParseError('invalid-card', `cards[${index}] is not an object`)
  }
  const keys = Object.keys(value)
  for (const key of keys) {
    if (
      key !== 'id' &&
      key !== 'title' &&
      key !== 'body' &&
      key !== 'status' &&
      key !== 'order' &&
      key !== 'createdAt'
    ) {
      throw new BoardFileParseError('invalid-card', `cards[${index}] has unknown field ${key}`)
    }
  }
  if (!isUuid(value.id)) {
    throw new BoardFileParseError('invalid-card', `cards[${index}].id is not a UUID`)
  }
  if (typeof value.title !== 'string') {
    throw new BoardFileParseError('invalid-card', `cards[${index}].title is not a string`)
  }
  const title = normalizeBoardTitle(value.title)
  if (!title.ok) {
    throw new BoardFileParseError('invalid-card', `cards[${index}].title is ${title.error.reason}`)
  }
  if (typeof value.status !== 'string' || !STATUS_SET.has(value.status)) {
    throw new BoardFileParseError('invalid-card', `cards[${index}].status is invalid`)
  }
  if (!isSafeNonNegativeInt(value.order)) {
    throw new BoardFileParseError('invalid-card', `cards[${index}].order is invalid`)
  }
  if (!isSafeNonNegativeInt(value.createdAt)) {
    throw new BoardFileParseError('invalid-card', `cards[${index}].createdAt is invalid`)
  }
  if (value.body !== undefined) {
    if (typeof value.body !== 'string') {
      throw new BoardFileParseError('invalid-card', `cards[${index}].body is not a string`)
    }
    if (value.body.length > BOARD_BODY_MAX_LENGTH) {
      throw new BoardFileParseError('invalid-card', `cards[${index}].body is too long`)
    }
  }

  const card: BoardFileCard = {
    id: value.id,
    title: title.title,
    status: value.status as BoardFileStatus,
    order: value.order,
    createdAt: value.createdAt,
  }
  if (value.body !== undefined) card.body = value.body
  return card
}

/** Parse an untrusted Board document. Throws {@link BoardFileParseError} on any violation. */
export function parseBoardFileV1(value: unknown): BoardFileV1 {
  if (!isRecord(value)) {
    throw new BoardFileParseError('malformed', 'Board file must be a JSON object')
  }
  const keys = Object.keys(value)
  for (const key of keys) {
    if (key !== 'version' && key !== 'cards') {
      throw new BoardFileParseError('malformed', `unknown field ${key}`)
    }
  }
  if (
    !('version' in value) ||
    typeof value.version !== 'number' ||
    !Number.isFinite(value.version)
  ) {
    throw new BoardFileParseError('malformed', 'version is required')
  }
  if (value.version !== BOARD_FILE_VERSION) {
    throw new BoardFileParseError(
      'incompatible-version',
      `unsupported Board file version ${String(value.version)}`,
    )
  }
  if (!Array.isArray(value.cards)) {
    throw new BoardFileParseError('malformed', 'cards must be an array')
  }

  const cards: BoardFileCard[] = []
  const seen = new Set<string>()
  for (let index = 0; index < value.cards.length; index += 1) {
    const card = parseCard(value.cards[index], index)
    if (seen.has(card.id)) {
      throw new BoardFileParseError('duplicate-id', `duplicate card id ${card.id}`)
    }
    seen.add(card.id)
    cards.push(card)
  }
  return { version: BOARD_FILE_VERSION, cards }
}

export function serializeBoardFileV1(value: BoardFileV1): string {
  // Round-trip through parse so callers cannot serialize an invalid document.
  const valid = parseBoardFileV1(value)
  return `${JSON.stringify(valid, null, 2)}\n`
}

/** Deterministic list order: order, then createdAt, then id. */
export function sortBoardCards(cards: readonly BoardFileCard[]): BoardFileCard[] {
  return [...cards].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
    if (a.id < b.id) return -1
    if (a.id > b.id) return 1
    return 0
  })
}

function cloneCard(card: BoardFileCard): BoardFileCard {
  const next: BoardFileCard = {
    id: card.id,
    title: card.title,
    status: card.status,
    order: card.order,
    createdAt: card.createdAt,
  }
  if (card.body !== undefined) next.body = card.body
  return next
}

function withCards(_file: BoardFileV1, cards: BoardFileCard[]): BoardFileV1 {
  return { version: BOARD_FILE_VERSION, cards }
}

export function planCreateBoardCard(
  file: BoardFileV1,
  input: {
    id: string
    title: string
    body?: string
    status?: BoardFileStatus
    order: number
    createdAt: number
  },
): { ok: true; file: BoardFileV1; card: BoardFileCard } | { ok: false; error: BoardTitleError } {
  const title = normalizeBoardTitle(input.title)
  if (!title.ok) return title
  if (input.body !== undefined && input.body.length > BOARD_BODY_MAX_LENGTH) {
    throw new BoardFileParseError('invalid-card', 'body is too long')
  }

  const card: BoardFileCard = {
    id: input.id,
    title: title.title,
    status: input.status ?? 'todo',
    order: input.order,
    createdAt: input.createdAt,
  }
  if (input.body !== undefined) card.body = input.body

  return {
    ok: true,
    file: withCards(file, [...file.cards.map(cloneCard), card]),
    card,
  }
}

export function planUpdateBoardCard(
  file: BoardFileV1,
  input: { cardId: string; title?: string; body?: string },
):
  | { ok: true; file: BoardFileV1; card: BoardFileCard }
  | { ok: false; error: BoardTitleError | BoardCardNotFoundError } {
  const index = file.cards.findIndex((card) => card.id === input.cardId)
  if (index < 0) {
    return { ok: false, error: { code: 'board.card-not-found', cardId: input.cardId } }
  }
  if (input.title === undefined && input.body === undefined) {
    return {
      ok: false,
      error: {
        code: 'board.invalid-title',
        reason: 'blank',
        maxLength: BOARD_TITLE_MAX_LENGTH,
      },
    }
  }

  const current = file.cards[index]
  if (current === undefined) {
    return { ok: false, error: { code: 'board.card-not-found', cardId: input.cardId } }
  }

  let title = current.title
  if (input.title !== undefined) {
    const normalized = normalizeBoardTitle(input.title)
    if (!normalized.ok) return normalized
    title = normalized.title
  }
  if (input.body !== undefined && input.body.length > BOARD_BODY_MAX_LENGTH) {
    throw new BoardFileParseError('invalid-card', 'body is too long')
  }

  const card = cloneCard(current)
  card.title = title
  if (input.body !== undefined) card.body = input.body

  const cards = file.cards.map(cloneCard)
  cards[index] = card
  return { ok: true, file: withCards(file, cards), card }
}

export function planMoveBoardCard(
  file: BoardFileV1,
  input: { cardId: string; status: BoardFileStatus; order: number },
):
  | { ok: true; file: BoardFileV1; card: BoardFileCard }
  | { ok: false; error: BoardCardNotFoundError } {
  const index = file.cards.findIndex((card) => card.id === input.cardId)
  if (index < 0) {
    return { ok: false, error: { code: 'board.card-not-found', cardId: input.cardId } }
  }
  const current = file.cards[index]
  if (current === undefined) {
    return { ok: false, error: { code: 'board.card-not-found', cardId: input.cardId } }
  }

  const card = cloneCard(current)
  card.status = input.status
  card.order = input.order

  const cards = file.cards.map(cloneCard)
  cards[index] = card
  return { ok: true, file: withCards(file, cards), card }
}

export function planDeleteBoardCard(
  file: BoardFileV1,
  input: { cardId: string },
): { ok: true; file: BoardFileV1; cardId: string } | { ok: false; error: BoardCardNotFoundError } {
  if (!file.cards.some((card) => card.id === input.cardId)) {
    return { ok: false, error: { code: 'board.card-not-found', cardId: input.cardId } }
  }
  return {
    ok: true,
    file: withCards(file, file.cards.filter((card) => card.id !== input.cardId).map(cloneCard)),
    cardId: input.cardId,
  }
}

export function planClearBoardColumn(
  file: BoardFileV1,
  input: { status: BoardFileStatus },
): { ok: true; file: BoardFileV1; status: BoardFileStatus; cardIds: string[] } {
  const removed = file.cards.filter((card) => card.status === input.status)
  return {
    ok: true,
    file: withCards(file, file.cards.filter((card) => card.status !== input.status).map(cloneCard)),
    status: input.status,
    cardIds: removed.map((card) => card.id),
  }
}
