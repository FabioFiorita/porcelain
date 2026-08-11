import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  type BoardFileCard,
  BoardFileParseError,
  type BoardFileStatus,
  emptyBoardFileV1,
  parseBoardFileV1,
  planCreateBoardCard,
  planDeleteBoardCard,
  planMoveBoardCard,
  planUpdateBoardCard,
  serializeBoardFileV1,
  sortBoardCards,
} from '@porcelain/shared/board-file'
import { PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { ensureProjectDir } from './project-io'

// Builtins + @porcelain/shared only — see cli.ts. Project board is strict v1 JSON.

export type BoardCard = BoardFileCard
export type CardStatus = BoardFileStatus

const STATUS_SET = new Set<string>(['todo', 'doing', 'done'])

function boardPath(repoPath: string): string {
  return projectPorcelainPath(repoPath, PROJECT_FILES.board)
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  )
}

function readBoardFile(repoPath: string): ReturnType<typeof emptyBoardFileV1> {
  let raw: string
  try {
    raw = readFileSync(boardPath(repoPath), 'utf8')
  } catch (error) {
    if (isEnoent(error)) return emptyBoardFileV1()
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new BoardFileParseError('malformed', 'Board file is not valid JSON')
  }

  // Legacy top-level array is not accepted — agents must use the v1 document.
  if (Array.isArray(parsed)) {
    throw new BoardFileParseError(
      'malformed',
      'Board file must be version 1 ({ version: 1, cards: [...] }); top-level arrays are not supported',
    )
  }

  return parseBoardFileV1(parsed)
}

function writeBoardFile(repoPath: string, file: ReturnType<typeof emptyBoardFileV1>): void {
  ensureProjectDir(repoPath)
  const path = boardPath(repoPath)
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, serializeBoardFileV1(file))
  renameSync(tmp, path)
}

export function normalizeStatus(value: unknown): CardStatus | null {
  return typeof value === 'string' && STATUS_SET.has(value) ? (value as CardStatus) : null
}

export function readCards(repoPath: string): BoardCard[] {
  return sortBoardCards(readBoardFile(repoPath).cards)
}

export function createCard(
  repoPath: string,
  title: string,
  body: string | undefined,
  status: CardStatus,
): BoardCard {
  const now = Date.now()
  const planned = planCreateBoardCard(readBoardFile(repoPath), {
    id: randomUUID(),
    title,
    body,
    status,
    order: now,
    createdAt: now,
  })
  if (!planned.ok) {
    throw new Error(
      planned.error.reason === 'blank' ? 'title is required' : 'title is too long (max 240)',
    )
  }
  writeBoardFile(repoPath, planned.file)
  return planned.card
}

export function updateCard(
  repoPath: string,
  id: string,
  fields: { title?: string; body?: string },
): boolean {
  const planned = planUpdateBoardCard(readBoardFile(repoPath), {
    cardId: id,
    title: fields.title,
    body: fields.body,
  })
  if (!planned.ok) {
    if (planned.error.code === 'board.card-not-found') return false
    throw new Error(
      planned.error.reason === 'blank' ? 'title is required' : 'title is too long (max 240)',
    )
  }
  writeBoardFile(repoPath, planned.file)
  return true
}

export function moveCard(repoPath: string, id: string, status: CardStatus): boolean {
  const planned = planMoveBoardCard(readBoardFile(repoPath), {
    cardId: id,
    status,
    order: Date.now(),
  })
  if (!planned.ok) return false
  writeBoardFile(repoPath, planned.file)
  return true
}

export function deleteCard(repoPath: string, id: string): boolean {
  const planned = planDeleteBoardCard(readBoardFile(repoPath), { cardId: id })
  if (!planned.ok) return false
  writeBoardFile(repoPath, planned.file)
  return true
}

const STATUS_LABEL: Record<CardStatus, string> = { todo: 'To do', doing: 'Doing', done: 'Done' }

export function describeBoard(repoPath: string, cards: BoardCard[]): string {
  if (cards.length === 0) {
    return `The project board for ${repoPath} is empty. The human (or you) adds cards in Porcelain; read them here to know what to build. Data: .porcelain/board.json`
  }
  const lines: string[] = [`Project board for ${repoPath} (${cards.length} card(s)):`]
  for (const status of ['todo', 'doing', 'done'] as const) {
    const inColumn = cards.filter((c) => c.status === status)
    if (inColumn.length === 0) continue
    lines.push(`\n## ${STATUS_LABEL[status]} (${inColumn.length})`)
    for (const card of inColumn) {
      lines.push(
        `- [${card.id}] ${card.title}${card.body ? `\n    ${card.body.replace(/\n/g, '\n    ')}` : ''}`,
      )
    }
  }
  return lines.join('\n')
}
