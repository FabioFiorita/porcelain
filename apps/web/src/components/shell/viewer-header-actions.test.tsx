import { TestIds } from '@shared/test-ids'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ViewerHeader } from './viewer-header'

// ViewerHeader reads the RIGHT sidebar's context for its own toggle.
vi.mock('@renderer/components/ui/sidebar', () => ({
  useSidebar: () => ({ toggleSidebar: vi.fn(), isMobile: false, openMobile: false, open: true }),
}))

// The roster itself is a whole feature with its own queries; this suite is about where it
// is reachable from, not what it lists.
vi.mock('@renderer/features/actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@renderer/features/actions')>()),
  ActionsGroup: () => <div data-testid="actions-group" />,
}))

vi.mock('./tab-bar', () => ({ TabBar: () => <div data-testid="tab-bar" /> }))
vi.mock('./use-viewer-breadcrumb', () => ({ useViewerBreadcrumb: () => [] }))

const { useActionRunStore } = await import('@renderer/features/actions')

describe('Actions in the Viewer header', () => {
  // The open flag lives in a store, so it outlives a render.
  beforeEach(() => {
    useActionRunStore.getState().setMenuOpen(false)
  })

  it('opens the roster on ⌘⇧A without touching the Viewer', () => {
    render(<ViewerHeader left={{ collapsed: false, toggle: vi.fn() }} />)
    expect(screen.queryByTestId('actions-group')).toBeNull()

    // Ctrl is the primary modifier off macOS, which is what vitest reports.
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true, shiftKey: true })

    // A popover, not a surface: whatever tab was open is still the one on screen.
    expect(screen.getByTestId('actions-group')).toBeTruthy()
  })

  it('exposes a header control that toggles the bottom terminal panel', () => {
    render(<ViewerHeader left={{ collapsed: false, toggle: vi.fn() }} />)
    const toggle = screen.getByTestId(TestIds.toggleTerminalPanel)
    expect(toggle).toHaveAttribute('aria-label', 'Toggle terminal panel')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens for an opener that needs one of its dialogs', () => {
    render(<ViewerHeader left={{ collapsed: false, toggle: vi.fn() }} />)

    // The file finder recovers a run that needs trust or a This-device folder this way:
    // both dialogs live on ActionsGroup, which mounts only inside this popover.
    act(() => {
      useActionRunStore.getState().setMenuOpen(true)
    })

    expect(screen.getByTestId('actions-group')).toBeTruthy()
  })
})
