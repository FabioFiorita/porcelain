import type { HubTarget } from '@porcelain/client-runtime/projects'
import type { CanvasRecord } from '@porcelain/contracts/projects'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasList } from './canvas-list'
import { useCanvasList, usePromoteCanvas } from './project-data'

// The domain seam: the Projects data hooks. Transport, tRPC, and the daemon
// stay behind it — this file is about what the human can and cannot do.
vi.mock('./project-data', () => ({
  useCanvasList: vi.fn(),
  usePromoteCanvas: vi.fn(),
}))

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
  tracked: false,
}

const TRACKED: CanvasRecord = { ...RECORD, id: 'canvas-2', title: 'Shipped', tracked: true }

describe('CanvasList', () => {
  const promoteCanvas = vi.fn(async () => ({ record: TRACKED, bundlePath: '/repo/.porcelain' }))

  beforeEach(() => {
    vi.clearAllMocks()
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useHubSelectionStore.setState({ selection: { kind: 'home' } })
    vi.mocked(usePromoteCanvas).mockReturnValue({ promote: promoteCanvas, isPending: false })
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

  it("opens against the list's own selected Worktree, not an unrelated focused tab's target", () => {
    // A file tab focused on a DIFFERENT Worktree than the one this sidebar is
    // scoped to — regression guard for using activeTabTarget() (focused-tab-first)
    // instead of the list's own target here.
    const otherTarget: HubTarget = { ...TARGET, worktreeId: 'wt-other', path: '/repo-other' }
    const otherTab = {
      id: 'file:other',
      kind: 'file' as const,
      title: 'other.ts',
      path: 'other.ts',
      target: otherTarget,
    }
    useTabsStore.setState({
      panes: [{ tabs: [otherTab], activeTabId: otherTab.id }],
      activePaneIndex: 0,
    })
    useHubSelectionStore.setState({ selection: { kind: 'worktree', ...TARGET } })
    vi.mocked(useCanvasList).mockReturnValue([RECORD])
    renderList()

    fireEvent.click(screen.getByTestId(TestIds.canvasListItem('canvas-1')))

    const pane = useTabsStore.getState().panes[0]
    if (pane === undefined) throw new Error('expected pane 0')
    const opened = pane.tabs.find((t) => t.kind === 'canvas')
    expect(opened?.target).toEqual(TARGET)
  })

  it('reads the Canvas list through the selected Worktree checkout', () => {
    useHubSelectionStore.setState({ selection: { kind: 'worktree', ...TARGET } })
    vi.mocked(useCanvasList).mockReturnValue([RECORD])
    renderList()
    expect(useCanvasList).toHaveBeenCalledWith('proj-1', '/repo', 'env-1')
  })

  it('badges a tracked Canvas and offers it no promotion', () => {
    useHubSelectionStore.setState({ selection: { kind: 'worktree', ...TARGET } })
    vi.mocked(useCanvasList).mockReturnValue([TRACKED])
    renderList()

    expect(screen.getByTestId(TestIds.canvasListTracked('canvas-2'))).toHaveTextContent('Tracked')
    expect(screen.queryByTestId(TestIds.canvasListMenu('canvas-2'))).toBeNull()
    expect(screen.queryByTestId(TestIds.canvasListPromote('canvas-2'))).toBeNull()
  })

  it('offers promotion on a private Canvas and never badges it tracked', async () => {
    useHubSelectionStore.setState({ selection: { kind: 'worktree', ...TARGET } })
    vi.mocked(useCanvasList).mockReturnValue([RECORD])
    renderList()

    expect(screen.queryByTestId(TestIds.canvasListTracked('canvas-1'))).toBeNull()
    fireEvent.click(screen.getByTestId(TestIds.canvasListMenu('canvas-1')))
    expect(await screen.findByTestId(TestIds.canvasListPromote('canvas-1'))).toBeInTheDocument()
  })

  it('promotes only after an explicit confirmation naming the target checkout', async () => {
    useHubSelectionStore.setState({ selection: { kind: 'worktree', ...TARGET } })
    vi.mocked(useCanvasList).mockReturnValue([RECORD])
    renderList()

    fireEvent.click(screen.getByTestId(TestIds.canvasListMenu('canvas-1')))
    fireEvent.click(await screen.findByTestId(TestIds.canvasListPromote('canvas-1')))
    // Opening the confirmation must not have promoted anything on its own.
    expect(promoteCanvas).not.toHaveBeenCalled()

    const confirm = await screen.findByTestId(TestIds.canvasPromoteConfirm)
    expect(confirm).toHaveTextContent('/repo')
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(promoteCanvas).toHaveBeenCalledWith({
        projectId: 'proj-1',
        canvasId: 'canvas-1',
        path: '/repo',
        worktreeId: 'wt-1',
        environmentId: 'env-1',
      }),
    )
  })

  it('offers no promotion affordance at all without a selected Worktree', () => {
    vi.mocked(useCanvasList).mockReturnValue([RECORD])
    renderList()

    expect(screen.queryByTestId(TestIds.canvasListMenu('canvas-1'))).toBeNull()
    expect(screen.queryByTestId(TestIds.canvasListPromote('canvas-1'))).toBeNull()
    expect(screen.queryByTestId(TestIds.canvasTrackDefaults)).toBeNull()
  })
})
