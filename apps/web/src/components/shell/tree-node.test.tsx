import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { type DirEntry, useFilesTree } from '@renderer/features/files'
import { useSelectionStore } from '@renderer/stores/selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TreeNode } from './tree-node'

vi.mock('@renderer/features/files', () => ({
  useFilesTree: vi.fn(),
  useFilesActions: () => ({ trash: async () => true, duplicate: async () => {} }),
  useFilesScopeActions: () => ({
    hide: async () => {},
    unhide: async () => {},
    pin: async () => {},
    unpin: async () => {},
  }),
  usePrefetchFileContent: () => () => {},
}))
vi.mock('@renderer/components/viewer/use-path-actions', () => ({
  usePathActions: () => ({ reveal: () => {}, copyPath: () => {}, copyRelativePath: () => {} }),
}))
vi.mock('@renderer/hooks/use-reveal-in-finder', () => ({ useCanRevealInFinder: () => false }))

const entry: DirEntry = { name: 'app.ts', path: '/repo/src/app.ts', kind: 'file' }
const other: DirEntry = { name: 'util.ts', path: '/repo/src/util.ts', kind: 'file' }

function renderTree(): void {
  render(
    <SidebarProvider>
      <TreeNode entry={entry} />
      <TreeNode entry={other} />
    </SidebarProvider>,
  )
}

describe('TreeNode', () => {
  beforeEach(() => {
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useSelectionStore.setState({ selected: new Set<string>() })
    vi.mocked(useFilesTree).mockReturnValue({ entries: [], error: null, isLoading: false })
  })

  it('marks the row whose file the viewer is showing', () => {
    const open = {
      id: tabId('file', entry.path),
      kind: 'file' as const,
      title: entry.name,
      path: entry.path,
    }
    useTabsStore.setState({ panes: [{ tabs: [open], activeTabId: open.id }], activePaneIndex: 0 })
    renderTree()

    expect(screen.getByTestId(TestIds.treeEntry('app.ts'))).toHaveAttribute('data-active')
    expect(screen.getByTestId(TestIds.treeEntry('util.ts'))).not.toHaveAttribute('data-active')
  })

  it('marks no row when the viewer has no file tab', () => {
    renderTree()
    expect(screen.getByTestId(TestIds.treeEntry('app.ts'))).not.toHaveAttribute('data-active')
  })

  it('marks a cmd-click selected row through the same selected state', () => {
    useSelectionStore.setState({ selected: new Set([other.path]) })
    renderTree()

    expect(screen.getByTestId(TestIds.treeEntry('util.ts'))).toHaveAttribute('data-active')
    expect(screen.getByTestId(TestIds.treeEntry('app.ts'))).not.toHaveAttribute('data-active')
  })
})
