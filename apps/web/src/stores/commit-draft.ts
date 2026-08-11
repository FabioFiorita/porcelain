import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Per-repo commit-message drafts. The commit composer lives in Quick Access, which
 * unmounts on every sidebar-tab switch, so keeping the half-written message in the
 * composer's own `useState` silently destroyed it on switch (write a message, flip to
 * Files, come back → gone). This store outlives that unmount, and — because it persists —
 * the draft also survives a reload.
 *
 * Keyed by repo path: one window is one repo, but keying keeps repo switches safe (each
 * repo keeps its own in-flight message instead of bleeding into the next).
 */
interface CommitDraftState {
  messages: Record<string, string>
  setMessage: (repoPath: string, message: string) => void
  clearMessage: (repoPath: string) => void
}

/**
 * Drafts are keyed by repo path and valued by raw message text — a shape `localStorage`
 * cannot be trusted to still hold. An entry whose value is not a string would be handed
 * straight to the composer's `value`, so the whole map falls back to empty rather than
 * half-loading: a lost draft is recoverable, a broken composer is not.
 */
const persistedCommitDraftsSchema = z
  .object({ messages: z.record(z.string(), z.string()) })
  .partial()

/** The drafts a persisted blob still describes correctly; `{}` for anything else. */
export function hydrateCommitDrafts(persisted: unknown): Partial<{
  messages: Record<string, string>
}> {
  const parsed = persistedCommitDraftsSchema.safeParse(persisted)
  if (!parsed.success || parsed.data.messages === undefined) return {}
  return { messages: parsed.data.messages }
}

export const useCommitDraftStore = create<CommitDraftState>()(
  persist(
    (set) => ({
      messages: {},
      setMessage: (repoPath: string, message: string) =>
        set((state) => ({ messages: { ...state.messages, [repoPath]: message } })),
      clearMessage: (repoPath: string) =>
        set((state) => {
          if (!(repoPath in state.messages)) return state
          const { [repoPath]: _removed, ...rest } = state.messages
          return { messages: rest }
        }),
    }),
    {
      name: 'porcelain-commit-drafts',
      merge: (persisted, current): CommitDraftState => ({
        ...current,
        ...hydrateCommitDrafts(persisted),
      }),
    },
  ),
)
