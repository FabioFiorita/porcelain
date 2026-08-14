import type { HubTarget } from '@porcelain/client-runtime/projects'
import { currentHubTarget } from './hub-selection'
import { type Tab, type TabKind, tabId, useTabsStore } from './tabs'

/** Target of the focused Viewer tab, else the selected Worktree. */
export function activeTabTarget(): HubTarget | null {
  const state = useTabsStore.getState()
  const pane = state.panes[state.activePaneIndex]
  return pane?.tabs.find((tab) => tab.id === pane.activeTabId)?.target ?? currentHubTarget()
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
    symbol?: string
    highlight?: { start: number; end: number }[]
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
    symbol: fields.symbol,
    highlight: fields.highlight,
    id: tabId(kind, fields.key ?? path, target),
    target: target ?? undefined,
  }
}
