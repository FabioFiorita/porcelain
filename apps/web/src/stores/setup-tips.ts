import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * One-time onboarding tips (Changes layers kickoff, Files scope focus, Settings
 * starter banner). Per-repo so dismissing on one tree does not hide tips elsewhere.
 * Not for the Review empty canvas — that always shows.
 */
const setupTipIdSchema = z.enum(['layers-kickoff', 'scope-kickoff', 'layers-settings'])
export type SetupTipId = z.infer<typeof setupTipIdSchema>

interface SetupTipsState {
  /** repoPath → tip ids the human dismissed. */
  dismissed: Record<string, Partial<Record<SetupTipId, true>>>
  dismiss: (repoPath: string, tip: SetupTipId) => void
  isDismissed: (repoPath: string, tip: SetupTipId) => boolean
}

/**
 * A retired tip id lives on in `localStorage` long after the tip is gone, so the persisted
 * map is parsed against the CURRENT vocabulary. `isDismissed` only ever asks about a known
 * id, so a foreign key is inert — but a foreign value would make `=== true` accidental.
 * Anything that is not a repo → tip → `true` map falls back to empty; within a valid map,
 * an unknown id is dropped alone so retiring one tip never un-dismisses the others.
 */
const persistedSetupTipsSchema = z
  .object({
    dismissed: z.record(z.string(), z.record(z.string(), z.literal(true))),
  })
  .partial()

/** The dismissals a persisted blob still describes correctly; `{}` for anything else. */
export function hydrateSetupTips(persisted: unknown): Partial<{
  dismissed: Record<string, Partial<Record<SetupTipId, true>>>
}> {
  const parsed = persistedSetupTipsSchema.safeParse(persisted)
  if (!parsed.success || parsed.data.dismissed === undefined) return {}
  const dismissed: Record<string, Partial<Record<SetupTipId, true>>> = {}
  for (const [repoPath, tips] of Object.entries(parsed.data.dismissed)) {
    const kept: Partial<Record<SetupTipId, true>> = {}
    for (const id of Object.keys(tips)) {
      const tip = setupTipIdSchema.safeParse(id)
      if (tip.success) kept[tip.data] = true
    }
    if (Object.keys(kept).length > 0) dismissed[repoPath] = kept
  }
  return { dismissed }
}

export const useSetupTipsStore = create<SetupTipsState>()(
  persist(
    (set, get) => ({
      dismissed: {},
      dismiss: (repoPath: string, tip: SetupTipId) =>
        set((state) => ({
          dismissed: {
            ...state.dismissed,
            [repoPath]: { ...state.dismissed[repoPath], [tip]: true },
          },
        })),
      isDismissed: (repoPath: string, tip: SetupTipId) => get().dismissed[repoPath]?.[tip] === true,
    }),
    {
      name: 'porcelain-setup-tips',
      merge: (persisted, current): SetupTipsState => ({
        ...current,
        ...hydrateSetupTips(persisted),
      }),
    },
  ),
)
