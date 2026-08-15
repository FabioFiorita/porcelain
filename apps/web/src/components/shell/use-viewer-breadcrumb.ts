import { useHubInventories } from '@renderer/features/projects'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useTabsStore } from '@renderer/stores/tabs'

export interface Breadcrumb {
  id: string
  label: string
}

/**
 * The Viewer's path line. In the Electron shell `useHubInventories` returns one entry per live
 * Environment, so a Project id alone is ambiguous — two Environments can hold equivalent Projects
 * with colliding ids. The Environment id from the active tab's target (or the Hub selection) is
 * what picks the right inventory; resolving without it would label a remote Worktree with a local
 * Project's name.
 */
export function useViewerBreadcrumb(): Breadcrumb[] {
  const inventories = useHubInventories()
  const selection = useHubSelectionStore((s) => s.selection)
  const selectedProject = useProjectSelectionStore((s) => s.project)
  const activeTab = useTabsStore((s) => {
    const pane = s.panes[s.activePaneIndex]
    return pane?.tabs.find((tab) => tab.id === pane.activeTabId) ?? null
  })

  const target = activeTab?.target
  const projectId =
    target?.projectId ?? (selection.kind === 'worktree' ? selection.projectId : null)
  const worktreeId =
    target?.worktreeId ?? (selection.kind === 'worktree' ? selection.worktreeId : null)
  const environmentId =
    target?.environmentId ?? (selection.kind === 'worktree' ? selection.environmentId : null)
  const inventory = inventories.find(
    (source) => source.inventory.environment.id === environmentId,
  )?.inventory
  const project = inventory?.projects.find((item) => item.id === projectId)
  const worktree = project?.worktrees.find((item) => item.id === worktreeId)
  const segments: Breadcrumb[] = []
  if (project?.name !== undefined) segments.push({ id: 'project', label: project.name })
  if (worktree?.branch !== undefined) segments.push({ id: 'worktree', label: worktree.branch })

  if (segments.length === 0 && selectedProject !== null) {
    segments.push({ id: 'selected-project', label: selectedProject.name })
  }
  if (activeTab !== null) segments.push({ id: 'tab', label: activeTab.title })
  return segments
}
