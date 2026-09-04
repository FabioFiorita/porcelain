import type { HubTarget } from '@porcelain/client-runtime/projects'
import { currentHubTarget } from './hub-selection'
import { type ReviewTarget, type Tab, type TabKind, tabId, useTabsStore } from './tabs'

/** Target of the focused Viewer tab, else the selected Worktree. */
export function activeTabTarget(): HubTarget | null {
  const state = useTabsStore.getState()
  const pane = state.panes[state.activePaneIndex]
  return pane?.tabs.find((tab) => tab.id === pane.activeTabId)?.target ?? currentHubTarget()
}

/** The active Changes/History scope, only when it belongs to the Canvas list's Worktree. */
export function activeReviewTarget(target: HubTarget): ReviewTarget | undefined {
  const state = useTabsStore.getState()
  const pane = state.panes[state.activePaneIndex]
  const tab = pane?.tabs.find((candidate) => candidate.id === pane.activeTabId)
  if (
    tab?.target?.environmentId !== target.environmentId ||
    tab.target?.projectId !== target.projectId ||
    tab.target?.worktreeId !== target.worktreeId
  ) {
    return undefined
  }
  if (tab.kind === 'diff') {
    return tab.base === undefined ? { type: 'working' } : { type: 'range', base: tab.base }
  }
  if (tab.kind === 'commit') return { type: 'commit', hash: tab.path }
  if (tab.kind !== 'changeset') return undefined
  if (tab.path === 'working') return { type: 'working' }
  if (tab.path.startsWith('branch:')) return { type: 'range', base: tab.path.slice(7) }
  if (tab.path.startsWith('commit:')) return { type: 'commit', hash: tab.path.slice(7) }
  return undefined
}

export function targetedTab(
  kind: TabKind,
  path: string,
  fields: {
    title: string
    key?: string
    preview?: boolean
    base?: string
    line?: number
    highlight?: { start: number; end: number }[]
    reviewTarget?: ReviewTarget
    reviewFilePath?: string
  },
  target: HubTarget | null = currentHubTarget(),
): Tab {
  return {
    kind,
    path,
    title: fields.title,
    preview: fields.preview,
    base: fields.base,
    line: fields.line,
    highlight: fields.highlight,
    reviewTarget: fields.reviewTarget,
    reviewFilePath: fields.reviewFilePath,
    id: tabId(kind, fields.key ?? path, target),
    target: target ?? undefined,
  }
}
