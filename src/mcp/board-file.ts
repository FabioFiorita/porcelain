import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Builtins only — see protocol.ts. The project-board channel: todo/doing/done cards
// the human (Porcelain app, board-store.ts) and the agent (here) both manage. The
// agent reads the board for what to build and moves cards as it works. Atomic writes
// (tmp + rename); the app re-validates with zod on read.

export const CARD_STATUSES = ['todo', 'doing', 'done'] as const
type CardStatus = (typeof CARD_STATUSES)[number]
const STATUS_SET = new Set<string>(CARD_STATUSES)

export interface BoardCard {
  id: string
  title: string
  body?: string
  status: CardStatus
  order: number
  createdAt: number
}

type Board = Record<string, BoardCard[]>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function boardPath(): string {
  return process.env.PORCELAIN_BOARD ?? join(homedir(), '.porcelain', 'board.json')
}

function parseCards(value: unknown): BoardCard[] {
  if (!Array.isArray(value)) return []
  const cards: BoardCard[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    if (typeof item.id !== 'string' || typeof item.title !== 'string') continue
    const status =
      typeof item.status === 'string' && STATUS_SET.has(item.status) ? item.status : 'todo'
    const card: BoardCard = {
      id: item.id,
      title: item.title,
      status: status as CardStatus,
      order: typeof item.order === 'number' ? item.order : 0,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
    }
    if (typeof item.body === 'string') card.body = item.body
    cards.push(card)
  }
  return cards
}

function readAll(): Board {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(boardPath(), 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const all: Board = {}
  for (const [repoPath, value] of Object.entries(parsed)) all[repoPath] = parseCards(value)
  return all
}

function writeAll(all: Board): void {
  const path = boardPath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(all, null, 2))
  renameSync(tmp, path)
}

export function normalizeStatus(value: unknown): CardStatus | null {
  return typeof value === 'string' && STATUS_SET.has(value) ? (value as CardStatus) : null
}

export function readCards(repoPath: string): BoardCard[] {
  const cards = readAll()[repoPath] ?? []
  return [...cards].sort((a, b) => a.order - b.order)
}

export function createCard(
  repoPath: string,
  title: string,
  body: string | undefined,
  status: CardStatus,
): BoardCard {
  const now = Date.now()
  const card: BoardCard = { id: randomUUID(), title, status, order: now, createdAt: now }
  if (body !== undefined) card.body = body
  const all = readAll()
  all[repoPath] = [...(all[repoPath] ?? []), card]
  writeAll(all)
  return card
}

export function updateCard(
  repoPath: string,
  id: string,
  fields: { title?: string; body?: string },
): boolean {
  const all = readAll()
  const card = all[repoPath]?.find((c) => c.id === id)
  if (!card) return false
  if (fields.title !== undefined) card.title = fields.title
  if (fields.body !== undefined) card.body = fields.body
  writeAll(all)
  return true
}

export function moveCard(repoPath: string, id: string, status: CardStatus): boolean {
  const all = readAll()
  const card = all[repoPath]?.find((c) => c.id === id)
  if (!card) return false
  card.status = status
  card.order = Date.now()
  writeAll(all)
  return true
}

export function deleteCard(repoPath: string, id: string): boolean {
  const all = readAll()
  const cards = all[repoPath]
  if (!cards?.some((c) => c.id === id)) return false
  all[repoPath] = cards.filter((c) => c.id !== id)
  writeAll(all)
  return true
}

const STATUS_LABEL: Record<CardStatus, string> = { todo: 'To do', doing: 'Doing', done: 'Done' }

/** Render the board for `list_cards`: cards grouped by column with id + title + body. */
export function describeBoard(repoPath: string, cards: BoardCard[]): string {
  if (cards.length === 0) {
    return `The project board for ${repoPath} is empty. The human (or you) adds cards in Porcelain; read them here to know what to build.`
  }
  const lines: string[] = [`Project board for ${repoPath} (${cards.length} card(s)):`]
  for (const status of CARD_STATUSES) {
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
