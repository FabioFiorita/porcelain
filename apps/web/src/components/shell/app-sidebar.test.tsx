import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { TestIds } from '@shared/test-ids'
import { render, screen } from '@testing-library/react'
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

// A stale daemon prompt must not restore the removed environment-update control.
vi.mock('@renderer/hooks/use-daemon-update-prompt', () => ({
  useDaemonUpdatePrompt: () => ({
    daemonName: 'beelink soap',
    daemonVersion: '0.59.0',
    clientVersion: '0.59.2',
    dismiss: vi.fn(),
  }),
}))

describe('AppSidebar', () => {
  beforeEach(() => {
    useHubSelectionStore.getState().selectHome()
  })

  it('shows logo, Porcelain, add-project, Search, Hub, and Settings', () => {
    render(<AppSidebar />)
    expect(screen.getByText('Porcelain')).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.hubAddProject)).toBeInTheDocument()
    expect(screen.queryByTestId(TestIds.daemonUpdateButton)).not.toBeInTheDocument()
    expect(
      screen.getByLabelText('Search commands, projects, files, and commits'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('hub-tree')).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.railSettings)).toBeInTheDocument()
    const search = screen.getByLabelText('Search commands, projects, files, and commits')
    const projects = screen.getByTestId('hub-tree')
    expect(search.compareDocumentPosition(projects) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
