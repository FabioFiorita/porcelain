import { randomUUID } from 'node:crypto'
import { PROJECT_FILES } from '@shared/project-porcelain'
import { z } from 'zod'
import { createProjectChannel } from '../net/project-channel'
import { ensureProjectCompanion } from '../project/migrate-home'

/**
 * Project board — todo/doing/done cards in `<repo>/.porcelain/board.json`.
 * TWO-WAY: app + CLI. Git-shareable when tracked.
 */
export const CARD_STATUSES = ['todo', 'doing', 'done'] as const
export type CardStatus = (typeof CARD_STATUSES)[number]

export const boardCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  status: z.enum(CARD_STATUSES).default('todo'),
  order: z.number().default(0),
  createdAt: z.number().default(0),
})
export type BoardCard = z.infer<typeof boardCardSchema>

const boardSchema = z.array(boardCardSchema)

const channel = createProjectChannel({
  fileName: PROJECT_FILES.board,
  schema: boardSchema,
  empty: (): BoardCard[] => [],
})

export function boardPath(repoPath: string): string {
  return channel.path(repoPath)
}

async function ready(repoPath: string): Promise<void> {
  await ensureProjectCompanion(repoPath)
}

export async function readCards(repoPath: string): Promise<BoardCard[]> {
  await ready(repoPath)
  const cards = await channel.read(repoPath)
  return [...cards].sort((a, b) => a.order - b.order)
}

export interface NewCard {
  title: string
  body?: string
  status?: CardStatus
}

export async function addCard(repoPath: string, input: NewCard): Promise<BoardCard> {
  await ready(repoPath)
  const now = Date.now()
  const card: BoardCard = {
    id: randomUUID(),
    title: input.title,
    status: input.status ?? 'todo',
    order: now,
    createdAt: now,
    ...(input.body !== undefined ? { body: input.body } : {}),
  }
  await channel.mutate(repoPath, (all) => [...all, card])
  return card
}

export async function updateCard(
  repoPath: string,
  id: string,
  fields: { title?: string; body?: string },
): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => {
    const card = all.find((c) => c.id === id)
    if (!card) return all
    if (fields.title !== undefined) card.title = fields.title
    if (fields.body !== undefined) card.body = fields.body
    return all
  })
}

export async function moveCard(repoPath: string, id: string, status: CardStatus): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => {
    const card = all.find((c) => c.id === id)
    if (!card) return all
    card.status = status
    card.order = Date.now()
    return all
  })
}

export async function deleteCard(repoPath: string, id: string): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => all.filter((c) => c.id !== id))
}

export async function clearCards(repoPath: string, status: CardStatus): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => all.filter((c) => c.status !== status))
}

export async function writeCards(repoPath: string, cards: BoardCard[]): Promise<void> {
  await ready(repoPath)
  await channel.write(repoPath, cards)
}
