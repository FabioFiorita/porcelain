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
 */
export function useHubRepoPath(): string | null {
  const override = useContext(HubRepoContext)
  const selected = useProjectSelectionStore((state) => state.project?.path ?? null)
  if (override !== undefined) return override
  return selected
}
