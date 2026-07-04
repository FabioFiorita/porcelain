import type { BoardCard, CardStatus } from '@backend/board-store'
import { create } from 'zustand'

/**
 * The board's create/edit-card intent. Both board surfaces (sidebar list + viewer
 * kanban) and the ⌘N shortcut open the composer through here, so a single
 * `CardComposer` (mounted in AppShell) shows — never two stacked dialogs when both
 * surfaces are mounted at once.
 */
export interface CardDraft {
  /** Present when editing an existing card; absent when creating a new one. */
  id?: string
  title: string
  body: string
  /** Column a new card lands in. */
  status: CardStatus
}

/** Build an edit draft from an existing card (used by both board surfaces). */
export function draftFromCard(card: BoardCard): CardDraft {
  return { id: card.id, title: card.title, body: card.body ?? '', status: card.status }
}

interface CardDraftState {
  draft: CardDraft | null
  open: (draft: CardDraft) => void
  close: () => void
}

export const useCardDraftStore = create<CardDraftState>((set) => ({
  draft: null,
  open: (draft) => set({ draft }),
  close: () => set({ draft: null }),
}))
