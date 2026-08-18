import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TitleBar } from './title-bar'

vi.mock('@renderer/lib/platform', () => ({ isLinuxShell: true }))

vi.mock('@renderer/hooks/use-window-controls', () => ({
  useWindowControls: () => ({
    isMaximized: false,
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  }),
}))

describe('frameless shell titlebar (Linux/Windows)', () => {
  it('draws the drag row with the min/maximize/close cluster', () => {
    render(<TitleBar />)
    expect(screen.getByLabelText('Minimize window')).toBeInTheDocument()
    expect(screen.getByLabelText('Maximize window')).toBeInTheDocument()
    expect(screen.getByLabelText('Close window')).toBeInTheDocument()
  })
})
