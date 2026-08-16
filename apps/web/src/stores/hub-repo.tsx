import type { HubTarget } from '@porcelain/client-runtime/projects'
import { createContext, type ReactNode, useContext } from 'react'
import { currentHubTarget } from './hub-selection'
import { useProjectSelectionStore } from './project-selection'

const HubRepoContext = createContext<HubTarget | null | undefined>(undefined)

/** Viewer panes bind daemon reads to the active tab's Worktree checkout. */
export function HubRepoProvider({
  target,
  children,
}: {
  /** Full identity of the Environment-owned checkout shown by this pane. */
  target: HubTarget | null
  children: ReactNode
}): React.JSX.Element {
  return <HubRepoContext.Provider value={target}>{children}</HubRepoContext.Provider>
}

/**
 * Full target for daemon queries. Inside a Viewer pane this is the tab's
 * Worktree; everywhere else it is the selected Worktree.
 *
 * The context value is three-state: `undefined` means no `HubRepoProvider` is
 * mounted above (fall through to the selected Worktree), while `null` means a
 * provider IS mounted but its tab has no Worktree target yet (stay null — do not
 * fall through to selection, or a target-bound tab would silently borrow it).
 */
export function useHubRepoTarget(): HubTarget | null {
  const override = useContext(HubRepoContext)
  if (override !== undefined) return override
  return currentHubTarget()
}

export function useHubRepoPath(): string | null {
  const override = useContext(HubRepoContext)
  const selected = useProjectSelectionStore((state) => state.project?.path ?? null)
  return override !== undefined ? (override?.path ?? null) : selected
}
