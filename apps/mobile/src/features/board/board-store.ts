import type { BoardCard, BoardStatus } from '@porcelain/contracts/board'
import { create } from 'zustand'

/**
 * Which board panel presents the shared composer.
 *
 * Every panel mounts the same `CardComposer`, and the one draft in this store names the panel
 * that opened it. A tablet showing the list, the kanban, and the Focus rail at once therefore
 * puts exactly one dialog on screen instead of three stacked copies of it — one composer, one
 * draft, one host.
 */
export type ComposerHost = 'companion' | 'list' | 'phone' | 'viewer'

/** The board's create/edit-card intent. Absent `id` means "create". */
export type CardDraft = {
  id?: string
  title: string
  body: string
  /** Column a new card lands in — and the column an edited card is moved to on save. */
  status: BoardStatus
  host: ComposerHost
}

/** Build an edit draft from an existing card — used by every panel's edit affordance. */
export function draftFromCard(card: BoardCard, host: ComposerHost): CardDraft {
  return { body: card.body ?? '', host, id: card.id, status: card.status, title: card.title }
}

type BoardState = {
  /** Explicit Focus selection, scoped by repo so a project switch cannot show another board's card. */
  focus: { repoPath: string; cardId: string } | null
  /** The single column a phone shows at a time; the tablet panels show all three. */
  column: BoardStatus
  draft: CardDraft | null
  select: (repoPath: string, cardId: string) => void
  setColumn: (column: BoardStatus) => void
  openDraft: (draft: CardDraft) => void
  closeDraft: () => void
}

/**
 * Board view state: what the Focus companion is showing, which column a phone is reading, and
 * the open card composer.
 *
 * Deliberately not persisted. The board itself lives on the daemon and the agent moves cards
 * under you, so a focus id restored from a cold start is a card that may no longer exist —
 * `resolveBoardFocus` falls back rather than showing a stale one.
 */
export const useBoardStore = create<BoardState>()((set) => ({
  column: 'doing',
  draft: null,
  focus: null,
  select: (repoPath, cardId) => {
    set({ focus: { cardId, repoPath } })
  },
  setColumn: (column) => {
    set({ column })
  },
  openDraft: (draft) => {
    set({ draft })
  },
  closeDraft: () => {
    set({ draft: null })
  },
}))

/** Column priority for the default Focus card when nothing is selected. */
const DEFAULT_STATUS_ORDER: readonly BoardStatus[] = ['doing', 'todo', 'done']

/**
 * The card the Focus companion should show for the current board.
 *
 * An explicit selection wins while it still exists on this repo; otherwise the first Doing
 * card, then the first To do, then the first Done — the same order the web rail falls back in.
 */
export function resolveBoardFocus(
  cards: readonly BoardCard[],
  repoPath: string | null,
  focus: { repoPath: string; cardId: string } | null,
): BoardCard | null {
  if (cards.length === 0) return null
  if (focus !== null && repoPath !== null && focus.repoPath === repoPath) {
    const selected = cards.find((card) => card.id === focus.cardId)
    if (selected !== undefined) return selected
  }
  for (const status of DEFAULT_STATUS_ORDER) {
    const first = cards
      .filter((card) => card.status === status)
      .sort((left, right) => left.order - right.order)[0]
    if (first !== undefined) return first
  }
  return cards[0] ?? null
}
