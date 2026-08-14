import { createContext, type ReactNode, useContext } from 'react'
import { useProjectSelectionStore } from './project-selection'

const HubRepoContext = createContext<string | null | undefined>(undefined)

/** Viewer panes bind daemon reads to the active tab's Worktree checkout. */
export function HubRepoProvider({
  repoPath,
  children,
}: {
  repoPath: string | null
  children: ReactNode
}): React.JSX.Element {
  return <HubRepoContext.Provider value={repoPath}>{children}</HubRepoContext.Provider>
}

/**
 * Checkout path for daemon queries. Inside a Viewer pane this is the tab's
 * Worktree; everywhere else it is the selected Worktree.
 *
 * The context value is three-state: `undefined` means no `HubRepoProvider` is
 * mounted above (fall through to the selected Worktree), while `null` means a
 * provider IS mounted but its tab has no Worktree path yet (stay null — do not
 * fall through to selection, or a target-bound tab would silently borrow it).
 */
export function useHubRepoPath(): string | null {
  const override = useContext(HubRepoContext)
  const selected = useProjectSelectionStore((state) => state.project?.path ?? null)
  if (override !== undefined) return override
  return selected
}
