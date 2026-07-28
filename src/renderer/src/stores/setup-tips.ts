import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * One-time onboarding tips (Changes layers kickoff, Files scope focus, Settings
 * starter banner). Per-repo so dismissing on one tree does not hide tips elsewhere.
 * Not for the Review empty canvas — that always shows.
 */
export type SetupTipId = 'layers-kickoff' | 'scope-kickoff' | 'layers-settings'

interface SetupTipsState {
  /** repoPath → tip ids the human dismissed. */
  dismissed: Record<string, Partial<Record<SetupTipId, true>>>
  dismiss: (repoPath: string, tip: SetupTipId) => void
  isDismissed: (repoPath: string, tip: SetupTipId) => boolean
}

export const useSetupTipsStore = create<SetupTipsState>()(
  persist(
    (set, get) => ({
      dismissed: {},
      dismiss: (repoPath, tip) =>
        set((state) => ({
          dismissed: {
            ...state.dismissed,
            [repoPath]: { ...state.dismissed[repoPath], [tip]: true },
          },
        })),
      isDismissed: (repoPath, tip) => get().dismissed[repoPath]?.[tip] === true,
    }),
    { name: 'porcelain-setup-tips' },
  ),
)
