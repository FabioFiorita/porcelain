import type { HubSelection, HubTarget } from '@porcelain/client-runtime/projects'
import { hubTargetOf } from '@porcelain/client-runtime/projects'
import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { useProjectSelectionStore } from './project-selection'

const nonEmpty = z.string().min(1)

const hubSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('home') }).strict(),
  z
    .object({
      kind: z.literal('project'),
      environmentId: nonEmpty,
      projectId: nonEmpty,
    })
    .strict(),
  z
    .object({
      kind: z.literal('worktree'),
      environmentId: nonEmpty,
      projectId: nonEmpty,
      worktreeId: nonEmpty,
      path: nonEmpty,
    })
    .strict(),
])

const persistedHubSelectionSchema = z
  .object({
    selection: hubSelectionSchema,
  })
  .partial()

/** The Hub selection a persisted blob still describes; home for anything else. */
export function hydrateHubSelection(persisted: unknown): { selection: HubSelection } {
  const parsed = persistedHubSelectionSchema.safeParse(persisted)
  if (!parsed.success || parsed.data.selection === undefined) {
    return { selection: { kind: 'home' } }
  }
  return { selection: parsed.data.selection }
}

interface HubSelectionStore {
  selection: HubSelection
  selectHome: () => void
  selectProject: (input: { environmentId: string; projectId: string }) => void
  selectWorktree: (input: {
    environmentId: string
    projectId: string
    worktreeId: string
    path: string
    name: string
  }) => void
}

export const useHubSelectionStore = create<HubSelectionStore>()(
  persist(
    (set) => ({
      selection: { kind: 'home' },
      selectHome: () => {
        set({ selection: { kind: 'home' } })
        useProjectSelectionStore.getState().selectProject(null)
      },
      selectProject: (input) => {
        set({
          selection: {
            kind: 'project',
            environmentId: input.environmentId,
            projectId: input.projectId,
          },
        })
        useProjectSelectionStore.getState().selectProject(null)
      },
      selectWorktree: (input) => {
        set({
          selection: {
            kind: 'worktree',
            environmentId: input.environmentId,
            projectId: input.projectId,
            worktreeId: input.worktreeId,
            path: input.path,
          },
        })
        useProjectSelectionStore.getState().selectProject({ path: input.path, name: input.name })
      },
    }),
    {
      name: 'porcelain-hub-selection',
      partialize: (state) => ({ selection: state.selection }),
      merge: (persisted, current): HubSelectionStore => ({
        ...current,
        ...hydrateHubSelection(persisted),
      }),
    },
  ),
)

export function currentHubTarget() {
  return hubTargetOf(useHubSelectionStore.getState().selection)
}

/**
 * Reactive counterpart to currentHubTarget — null unless a Worktree is selected.
 * `useShallow`: hubTargetOf builds a fresh object every call, and useSyncExternalStore
 * (what zustand's hook is built on) requires a snapshot that's referentially stable
 * when nothing changed, or React loops re-rendering forever.
 */
export function useHubTarget(): HubTarget | null {
  return useHubSelectionStore(useShallow((s) => hubTargetOf(s.selection)))
}
