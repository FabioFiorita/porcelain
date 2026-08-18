import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ViewerHeader } from './viewer-header'

// The macOS shell is the only client whose window paints chrome the renderer does not
// control, and `isBrowser` is true under vitest (no preload) — so this branch is
// unreachable without pinning the flag, the same way worktree-switcher.test.tsx does.
vi.mock('@renderer/lib/platform', () => ({
  isBrowser: false,
  isE2E: false,
  isLinuxShell: false,
  isFramelessShell: false,
  isMacShell: true,
  isCoarseTouch: () => false,
}))

// ViewerHeader reads the RIGHT sidebar's context for its own toggle; the left panel
// arrives as a prop, which is the state under test here.
vi.mock('@renderer/components/ui/sidebar', () => ({
  useSidebar: () => ({ toggleSidebar: vi.fn(), isMobile: false, openMobile: false, open: true }),
}))

vi.mock('@renderer/features/actions', () => ({
  ActionsGroup: () => <div data-testid="actions-group" />,
}))

vi.mock('./tab-bar', () => ({ TabBar: () => <div data-testid="tab-bar" /> }))

// Reaches the daemon through tRPC for the crumb trail; the header row's padding is what
// this suite is about, so stub it rather than standing up a transport.
vi.mock('./use-viewer-breadcrumb', () => ({ useViewerBreadcrumb: () => [] }))

function headerElement(): HTMLElement {
  const toggle = screen.getByLabelText('Toggle projects sidebar')
  const header = toggle.closest('.app-drag')
  if (!(header instanceof HTMLElement)) throw new Error('expected the Viewer header row')
  return header
}

describe('ViewerHeader traffic-light clearance on macOS', () => {
  it('clears the traffic lights once the left sidebar collapses onto this corner', () => {
    // Collapsed, the left sidebar slides fully off (collapsible="offcanvas") and this row
    // inherits the window's top-left corner. macOS still paints its traffic lights over
    // x:19-70 there, and the toggle button below is the ONLY way back to the sidebar —
    // at the default pl-2 gutter it lands at x≈17-45, under the close button.
    render(<ViewerHeader left={{ collapsed: true, toggle: vi.fn() }} />)

    expect(headerElement()).toHaveClass('pl-20')
    expect(headerElement()).not.toHaveClass('pl-2')
  })

  it('leaves the ordinary gutter while the sidebar still owns that corner', () => {
    // app-sidebar.tsx reserves the clearance itself when it is open; doing it here too
    // would indent the Viewer header by 80px for no reason.
    render(<ViewerHeader left={{ collapsed: false, toggle: vi.fn() }} />)

    expect(headerElement()).toHaveClass('pl-2')
    expect(headerElement()).not.toHaveClass('pl-20')
  })
})
