import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useNewTaskDialogStore } from '@renderer/stores/new-task-dialog'
import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppSidebar } from './app-sidebar'

vi.mock('@renderer/features/projects', () => ({
  HubTree: () => <div data-testid="hub-tree">Projects</div>,
}))

vi.mock('@renderer/components/settings/settings-dialog', () => ({
  SettingsButton: ({ showLabel }: { showLabel?: boolean }) => (
    <button type="button" data-testid={TestIds.railSettings}>
      {showLabel ? 'Settings' : null}
    </button>
  ),
}))

vi.mock('@renderer/components/ui/sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSidebar: () => ({ state: 'expanded', isMobile: false }),
}))

// The update chip moved into the sidebar header (was Electron-titlebar-only, so browser
// clients never got it) — same hook mock title-bar.test.tsx used.
vi.mock('@renderer/hooks/use-updates', () => ({
  useUpdateStatus: () => ({ state: 'idle', version: null, error: null, currentVersion: '0.49.0' }),
  useInstallUpdate: () => ({ install: vi.fn(), isInstalling: false }),
}))

describe('AppSidebar', () => {
  beforeEach(() => {
    useHubSelectionStore.getState().selectHome()
    useTabsStore.getState().closeAllTabs()
    useNewTaskDialogStore.getState().hide()
  })

  it('shows logo, Porcelain, and add-project', () => {
    render(<AppSidebar />)
    expect(screen.getByText('Porcelain')).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.hubAddProject)).toBeInTheDocument()
    expect(
      screen.getByLabelText('Search commands, projects, files, and commits'),
    ).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.tasksOpen)).toBeInTheDocument()
    expect(screen.getByTestId('hub-tree')).toBeInTheDocument()
    const search = screen.getByLabelText('Search commands, projects, files, and commits')
    const tasks = screen.getByTestId(TestIds.tasksOpen)
    const projects = screen.getByTestId('hub-tree')
    expect(search.compareDocumentPosition(tasks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(tasks.compareDocumentPosition(projects) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('opens Tasks in the Viewer without changing the selected worktree', () => {
    useHubSelectionStore.getState().selectWorktree({
      environmentId: 'env-1',
      projectId: 'proj-1',
      worktreeId: 'wt-1',
      path: '/repo',
      name: 'main',
    })
    render(<AppSidebar />)
    fireEvent.click(screen.getByTestId(TestIds.tasksOpen))
    const pane = useTabsStore.getState().panes[0]
    expect(pane?.tabs.some((tab) => tab.kind === 'tasks')).toBe(true)
    expect(useHubSelectionStore.getState().selection).toEqual({
      kind: 'worktree',
      environmentId: 'env-1',
      projectId: 'proj-1',
      worktreeId: 'wt-1',
      path: '/repo',
    })
    expect(screen.getByTestId(TestIds.tasksOpen)).toHaveAttribute('aria-current', 'page')
  })

  it('opens the new-task dialog from the plus without opening the board', () => {
    render(<AppSidebar />)
    const plus = screen.getByTestId(TestIds.tasksNew)
    expect(screen.getByTestId(TestIds.tasksOpen).contains(plus)).toBe(false)
    fireEvent.click(plus)
    expect(useNewTaskDialogStore.getState().open).toBe(true)
    expect(useTabsStore.getState().panes[0]?.tabs).toEqual([])
  })
})
