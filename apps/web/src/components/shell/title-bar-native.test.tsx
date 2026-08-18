import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TitleBar } from './title-bar'

// macOS Electron and the browser client both hit this branch: neither draws its own
// titlebar row (native traffic lights on macOS, no window chrome at all in the browser).
vi.mock('@renderer/lib/platform', () => ({ isLinuxShell: false }))

describe('frameless shell titlebar (macOS / browser)', () => {
  it('renders nothing — no drawn row needed', () => {
    const { container } = render(<TitleBar />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByLabelText('Minimize window')).toBeNull()
  })
})
