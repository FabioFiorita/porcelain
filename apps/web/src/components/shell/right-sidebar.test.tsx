import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SurfaceTabs } from './right-sidebar'

describe('SurfaceTabs', () => {
  it('keeps the surface shortcut badges inside a comfortably sized picker', () => {
    render(
      <SurfaceTabs
        openTabs={['files']}
        activeTab="files"
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
        onReplaceTabs={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open a surface' }))
    const content = screen.getByText('Changes').closest('[data-slot="dropdown-menu-content"]')
    expect(content).toHaveClass('w-44')
    expect(
      screen.getByText('Changes').parentElement?.querySelector('[data-slot="kbd-group"]'),
    ).toHaveClass('shrink-0')
  })

  it('closes others and reorders from the tab chrome', () => {
    const onClose = vi.fn()
    const onReplaceTabs = vi.fn()
    render(
      <SurfaceTabs
        openTabs={['files', 'changes', 'git']}
        activeTab="changes"
        onActivate={vi.fn()}
        onClose={onClose}
        onOpen={vi.fn()}
        onReplaceTabs={onReplaceTabs}
      />,
    )

    fireEvent.contextMenu(screen.getByTestId(TestIds.railTab('changes')))
    fireEvent.click(screen.getByTestId(TestIds.railTabMenu('close-others')))
    expect(onReplaceTabs).toHaveBeenCalledWith(['changes'], 'changes')

    onReplaceTabs.mockClear()
    const filesTab = screen.getByTestId(TestIds.railTab('files')).closest('[draggable]')
    if (!(filesTab instanceof HTMLElement)) throw new Error('expected a draggable surface tab')
    fireEvent.drop(filesTab, {
      dataTransfer: { getData: () => 'git', dropEffect: 'move' },
    })
    expect(onReplaceTabs).toHaveBeenCalledWith(['git', 'files', 'changes'])

    fireEvent(filesTab, new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(onClose).toHaveBeenCalledWith('files')
  })
})
