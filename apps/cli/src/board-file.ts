import { randomUUID } from 'node:crypto'
import { PROJECT_FILES } from '@shared/project-porcelain'
import { readProjectJson, writeProjectJson } from './project-io'

// Builtins only — see cli.ts. Project board in <repo>/.porcelain/board.json.

const CARD_STATUSES = ['todo', 'doing', 'done'] as const
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

function readAll(repoPath: string): BoardCard[] {
  return parseCards(readProjectJson(repoPath, PROJECT_FILES.board))
}

function writeAll(repoPath: string, cards: BoardCard[]): void {
  writeProjectJson(repoPath, PROJECT_FILES.board, cards)
}

export function normalizeStatus(value: unknown): CardStatus | null {
  return typeof value === 'string' && STATUS_SET.has(value) ? (value as CardStatus) : null
}

export function readCards(repoPath: string): BoardCard[] {
  return [...readAll(repoPath)].sort((a, b) => a.order - b.order)
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
  writeAll(repoPath, [...readAll(repoPath), card])
  return card
}

export function updateCard(
  repoPath: string,
  id: string,
  fields: { title?: string; body?: string },
): boolean {
  const cards = readAll(repoPath)
  const card = cards.find((c) => c.id === id)
  if (!card) return false
  if (fields.title !== undefined) card.title = fields.title
  if (fields.body !== undefined) card.body = fields.body
  writeAll(repoPath, cards)
  return true
}

export function moveCard(repoPath: string, id: string, status: CardStatus): boolean {
  const cards = readAll(repoPath)
  const card = cards.find((c) => c.id === id)
  if (!card) return false
  card.status = status
  card.order = Date.now()
  writeAll(repoPath, cards)
  return true
}

export function deleteCard(repoPath: string, id: string): boolean {
  const cards = readAll(repoPath)
  if (!cards.some((c) => c.id === id)) return false
  writeAll(
    repoPath,
    cards.filter((c) => c.id !== id),
  )
  return true
}

const STATUS_LABEL: Record<CardStatus, string> = { todo: 'To do', doing: 'Doing', done: 'Done' }

export function describeBoard(repoPath: string, cards: BoardCard[]): string {
  if (cards.length === 0) {
    return `The project board for ${repoPath} is empty. The human (or you) adds cards in Porcelain; read them here to know what to build. Data: .porcelain/board.json`
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
