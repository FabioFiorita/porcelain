import type { AgentImage } from '@shared/agent-protocol'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * An in-memory image attachment staged in the composer: base64 for the wire, a data URL for
 * the chip preview, and the downscaled thumbnail persisted with the sent message. Hoisted here
 * (out of agent-composer.tsx) because the draft store owns it now.
 */
export interface Attachment {
  id: string
  mediaType: string
  base64: string
  dataUrl: string
  // The downscaled preview persisted in the timeline (see makeThumbnail); absent if the image
  // couldn't be re-encoded — the send still carries the full image, just no stored thumbnail.
  thumbnail: AgentImage | null
}

interface Draft {
  text: string
  images: Attachment[]
}

/**
 * Per-thread composer drafts. The Agent view unmounts on every viewer-tab switch, so keeping
 * the half-written message in the composer's own `useState` silently destroyed it on switch —
 * this store outlives that unmount so a draft survives.
 *
 * The TEXT also survives a reload (persisted to localStorage); the IMAGES deliberately do NOT.
 * They're base64 data-URLs that would blow the localStorage quota, and in-memory survival across
 * tab switches is all they need — so `partialize` strips them before serializing, and a rehydrated
 * entry comes back with text but no images (defaulted back to [] on merge). Keyed by thread id.
 */
interface AgentDraftsState {
  drafts: Record<string, Draft>
  /** Merge a partial patch into a thread's draft (creating an empty one if absent). */
  setDraft: (threadId: string, patch: Partial<Draft>) => void
  /** Drop a thread's draft entirely (on send or when the thread is deleted). */
  clearDraft: (threadId: string) => void
}

const emptyDraft = (): Draft => ({ text: '', images: [] })

export const useAgentDraftsStore = create<AgentDraftsState>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (threadId, patch) =>
        set((state) => {
          const current = state.drafts[threadId] ?? emptyDraft()
          return { drafts: { ...state.drafts, [threadId]: { ...current, ...patch } } }
        }),
      clearDraft: (threadId) =>
        set((state) => {
          if (!(threadId in state.drafts)) return state
          const { [threadId]: _removed, ...rest } = state.drafts
          return { drafts: rest }
        }),
    }),
    {
      name: 'porcelain-agent-drafts',
      // Persist ONLY the text of each draft — images are base64 data-URLs too large for the
      // localStorage quota (see the store doc above).
      partialize: (state) => ({
        drafts: Object.fromEntries(
          Object.entries(state.drafts).map(([id, draft]) => [id, { text: draft.text }]),
        ),
      }),
      // Rehydrated drafts carry text but no images — normalize each back to the full shape so the
      // rest of the store never has to guard for a missing `images`.
      merge: (persisted, current) => {
        const saved = (persisted as { drafts?: Record<string, { text?: string }> } | undefined)
          ?.drafts
        const drafts: Record<string, Draft> = {}
        for (const [id, draft] of Object.entries(saved ?? {})) {
          const text = draft?.text ?? ''
          if (text !== '') drafts[id] = { text, images: [] }
        }
        return { ...current, drafts }
      },
    },
  ),
)
