import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'

/**
 * The project-board channel: todo/doing/done cards the human and the agent both
 * manage, keyed by absolute repo path, in `~/.porcelain/board.json` (same fixed
 * home-dir location rationale as the review-set + comment channels). TWO-WAY: the
 * app authors cards (add/edit/move/delete here) and the MCP server (src/mcp/
 * board-file.ts) does the same — the agent reads the board for what to build and
 * moves cards as it works. Atomic (tmp + rename) + in-process-serialized writes; a
 * cross-process race is rare/low-stakes and the watcher re-syncs.
 */
export const CARD_STATUSES = ['todo', 'doing', 'done'] as const
export type CardStatus = (typeof CARD_STATUSES)[number]

export const boardCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  status: z.enum(CARD_STATUSES).default('todo'),
  /** Sort key within a column; set on create and bumped on move so a moved card
   * lands at the end of its new column. */
  order: z.number().default(0),
  createdAt: z.number().default(0),
})
export type BoardCard = z.infer<typeof boardCardSchema>

export const boardSchema = z.record(z.string(), z.array(boardCardSchema))
export type Board = z.infer<typeof boardSchema>

export function boardPath(): string {
  // Must match src/mcp/board-file.ts. PORCELAIN_BOARD redirects both sides for tests.
  return process.env.PORCELAIN_BOARD ?? join(homedir(), '.porcelain', 'board.json')
}

async function readAll(): Promise<Board> {
  try {
    return boardSchema.parse(JSON.parse(await readFile(boardPath(), 'utf8')))
  } catch {
    return {}
  }
}

async function writeAll(all: Board): Promise<void> {
  const path = boardPath()
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(all, null, 2))
  await rename(tmp, path)
}

let chain: Promise<void> = Promise.resolve()
function mutate<T>(fn: (all: Board) => T): Promise<T> {
  const run = chain.then(async () => {
    const all = await readAll()
    const result = fn(all)
    await writeAll(all)
    return result
  })
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/** The cards for a repo, sorted by column order (oldest/first at the top). */
export async function readCards(repoPath: string): Promise<BoardCard[]> {
  const cards = (await readAll())[repoPath] ?? []
  return [...cards].sort((a, b) => a.order - b.order)
}

export interface NewCard {
  title: string
  body?: string
  status?: CardStatus
}

export async function addCard(repoPath: string, input: NewCard): Promise<BoardCard> {
  const now = Date.now()
  const card: BoardCard = {
    id: randomUUID(),
    title: input.title,
    status: input.status ?? 'todo',
    order: now,
    createdAt: now,
    ...(input.body !== undefined ? { body: input.body } : {}),
  }
  await mutate((all) => {
    all[repoPath] = [...(all[repoPath] ?? []), card]
  })
  return card
}

export async function updateCard(
  repoPath: string,
  id: string,
  fields: { title?: string; body?: string },
): Promise<void> {
  await mutate((all) => {
    const card = all[repoPath]?.find((c) => c.id === id)
    if (!card) return
    if (fields.title !== undefined) card.title = fields.title
    if (fields.body !== undefined) card.body = fields.body
  })
}

export async function moveCard(repoPath: string, id: string, status: CardStatus): Promise<void> {
  await mutate((all) => {
    const card = all[repoPath]?.find((c) => c.id === id)
    if (!card) return
    card.status = status
    card.order = Date.now() // bump so it lands at the end of the target column
  })
}

export async function deleteCard(repoPath: string, id: string): Promise<void> {
  await mutate((all) => {
    const cards = all[repoPath]
    if (cards) all[repoPath] = cards.filter((c) => c.id !== id)
  })
}
