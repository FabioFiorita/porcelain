import type { BoardCard, BoardStatus } from '@porcelain/contracts/board'
import { create } from 'zustand'

/**
 * Which board card the Focus companion (right rail) is showing. Client-only —
 * not persisted. Click a card in the sidebar list or wide kanban to select it;
 * with no explicit selection (or a stale id), the companion falls back to the
 * first Doing card, then Todo, then any remaining card. Selection is scoped by
 * Project path so a window switch never shows another board's focus id.
 *
 * Cards themselves remain Query data — this store holds focus only.
 */

interface BoardSelectionState {
  /** Explicit focus: project + card id. Null = use default for the current board. */
  focus: { repoPath: string; cardId: string } | null
  select: (repoPath: string, cardId: string) => void
  clear: () => void
}

export const useBoardSelectionStore = create<BoardSelectionState>((set) => ({
  focus: null,
  select: (repoPath: string, cardId: string) => set({ focus: { repoPath, cardId } }),
  clear: () => set({ focus: null }),
}))

/** Column priority for the default Focus card when nothing is selected. */
const DEFAULT_STATUS_ORDER: readonly BoardStatus[] = ['doing', 'todo', 'done']

/**
 * The card the Focus companion should show for the current board snapshot.
 * Prefer an explicit selection that still exists on this project; otherwise the
 * first card in Doing (by column order), then Todo, then Done.
 */
export function resolveBoardFocus(
  cards: readonly BoardCard[],
  repoPath: string | null | undefined,
  focus: { repoPath: string; cardId: string } | null,
): BoardCard | null {
  if (cards.length === 0) return null
  const selectedId =
    focus !== null && repoPath !== null && repoPath !== undefined && focus.repoPath === repoPath
      ? focus.cardId
      : null
  if (selectedId !== null) {
    const found = cards.find((c) => c.id === selectedId)
    if (found) return found
  }
  for (const status of DEFAULT_STATUS_ORDER) {
    const inColumn = cards.filter((c) => c.status === status).sort((a, b) => a.order - b.order)
    const first = inColumn[0]
    if (first) return first
  }
  return cards[0] ?? null
}
