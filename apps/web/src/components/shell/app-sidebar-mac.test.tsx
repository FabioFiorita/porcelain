import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { TestIds } from '@shared/test-ids'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppSidebar } from './app-sidebar'

// `isBrowser` is true under vitest (no preload), so the shell branches of this file are
// unreachable unless the flag is pinned — the sibling app-sidebar.test.tsx covers the
// browser default and would keep passing no matter what the macOS branch does.
vi.mock('@renderer/lib/platform', () => ({
  isBrowser: false,
  isE2E: false,
  isLinuxShell: false,
  isFramelessShell: false,
  isMacShell: true,
  isCoarseTouch: () => false,
}))

vi.mock('@renderer/features/projects', () => ({
  HubTree: () => <div data-testid="hub-tree">Projects</div>,
}))

vi.mock('@renderer/components/settings/settings-dialog', () => ({
  SettingsButton: () => <button type="button" data-testid={TestIds.railSettings} />,
}))

vi.mock('@renderer/hooks/use-updates', () => ({
  useUpdateStatus: () => ({ state: 'idle', version: null, error: null, currentVersion: '0.49.0' }),
  useInstallUpdate: () => ({ install: vi.fn(), isInstalling: false }),
}))

// Its sibling chip reads daemonInfo through tRPC; this suite renders without a provider.
vi.mock('@renderer/hooks/use-daemon-update-prompt', () => ({
  useDaemonUpdatePrompt: () => null,
}))

// Unlike app-sidebar.test.tsx's stub, this one forwards className: the placement of this
// panel against the window frame IS the behaviour under test, and it lives nowhere but
// these class strings.
vi.mock('@renderer/components/ui/sidebar', () => ({
  Sidebar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="sidebar-root" className={className}>
      {children}
    </div>
  ),
  SidebarHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="sidebar-header" className={className}>
      {children}
    </div>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSidebar: () => ({ state: 'expanded', isMobile: false }),
}))

beforeEach(() => {
  useHubSelectionStore.getState().selectHome()
})

describe('AppSidebar on the macOS shell', () => {
  it('reserves the traffic-light clearance in the header it owns at the window corner', () => {
    render(<AppSidebar />)

    // 80px, because macOS paints its traffic lights over x:19-70 no matter what this
    // header draws. At the browser's pl-3 the logo would sit underneath them.
    expect(screen.getByTestId('sidebar-header')).toHaveClass('pl-20')
    expect(screen.getByTestId('sidebar-header')).not.toHaveClass('pl-3')
  })

  it('starts at the true window top — macOS draws no titlebar row to sit under', () => {
    render(<AppSidebar />)

    // The 3rem offset belongs to the frameless shell alone (title-bar.tsx). Applying it
    // here would leave an empty 48px band above the sidebar on macOS, which is exactly
    // the wasted row this chrome was reclaiming.
    expect(screen.getByTestId('sidebar-root').className).not.toContain('3rem')
  })
})
