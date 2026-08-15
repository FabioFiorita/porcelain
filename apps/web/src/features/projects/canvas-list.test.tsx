import type { HubTarget } from '@porcelain/client-runtime/projects'
import type { CanvasRecord } from '@porcelain/contracts/projects'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasList } from './canvas-list'
import { useCanvasList } from './project-data'

vi.mock('./project-data', () => ({ useCanvasList: vi.fn() }))

function renderList(): void {
  render(
    <SidebarProvider>
      <CanvasList />
    </SidebarProvider>,
  )
}

const TARGET: HubTarget = {
  environmentId: 'env-1',
  projectId: 'proj-1',
  worktreeId: 'wt-1',
  path: '/repo',
}

const RECORD: CanvasRecord = {
  id: 'canvas-1',
  worktreeId: 'wt-1',
  title: 'Intent',
  kind: 'html',
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T09:00:00.000Z',
}

describe('CanvasList', () => {
  beforeEach(() => {
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useHubSelectionStore.setState({ selection: { kind: 'home' } })
  })

  it('asks the user to select a Worktree with no Hub target', () => {
    vi.mocked(useCanvasList).mockReturnValue([])
    renderList()
    expect(screen.getByText(/select a worktree/i)).toBeInTheDocument()
  })

  it('shows the empty state for a selected Worktree with no Canvases', () => {
    useHubSelectionStore.setState({ selection: { kind: 'worktree', ...TARGET } })
    vi.mocked(useCanvasList).mockReturnValue([])
    renderList()
    expect(screen.getByTestId(TestIds.canvasListEmpty)).toBeInTheDocument()
  })

  it('lists a Canvas and opens a targeted canvas tab on click', () => {
    useHubSelectionStore.setState({ selection: { kind: 'worktree', ...TARGET } })
    vi.mocked(useCanvasList).mockReturnValue([RECORD])
    renderList()

    fireEvent.click(screen.getByTestId(TestIds.canvasListItem('canvas-1')))

    const pane = useTabsStore.getState().panes[0]
    if (pane === undefined) throw new Error('expected pane 0')
    expect(pane.tabs).toHaveLength(1)
    const tab = pane.tabs[0]
    expect(tab?.kind).toBe('canvas')
    expect(tab?.path).toBe('canvas-1')
    expect(tab?.title).toBe('Intent')
    expect(tab?.target).toEqual(TARGET)
  })
})
