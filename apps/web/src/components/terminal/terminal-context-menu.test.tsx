import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TerminalContextMenu } from './terminal-context-menu'

const selectionText = vi.fn()
const copySelection = vi.fn().mockResolvedValue(undefined)
const pasteClipboard = vi.fn().mockResolvedValue(undefined)
const pasteImage = vi.fn().mockResolvedValue(undefined)
const chooseFiles = vi.fn()
const selectAll = vi.fn()
const clearViewport = vi.fn()

vi.mock('@renderer/lib/terminal-registry', () => ({
  terminalSelectionText: (): ReturnType<typeof selectionText> => selectionText(),
  copyTerminalSelection: (...args: unknown[]) => copySelection(...args),
  pasteTerminalClipboard: (...args: unknown[]) => pasteClipboard(...args),
  pasteTerminalImage: (...args: unknown[]) => pasteImage(...args),
  chooseTerminalFiles: (...args: unknown[]) => chooseFiles(...args),
  selectAllTerminal: (...args: unknown[]) => selectAll(...args),
  clearTerminalViewport: (...args: unknown[]) => clearViewport(...args),
}))

vi.mock('@renderer/components/ui/context-menu', () => ({
  ContextMenu: ({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode
    onOpenChange?: (open: boolean) => void
  }) => (
    <button type="button" onContextMenu={() => onOpenChange?.(true)}>
      {children}
    </button>
  ),
  ContextMenuTrigger: ({ children, ...props }: React.ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  ),
  ContextMenuContent: ({ children, ...props }: React.ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  ),
  ContextMenuItem: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <hr />,
  ContextMenuShortcut: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

describe('TerminalContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectionText.mockReturnValue('selected output')
  })

  it('routes all terminal menu commands through renderer-neutral registry actions', async () => {
    render(
      <TerminalContextMenu sessionId="s1">
        <div>terminal</div>
      </TerminalContextMenu>,
    )
    fireEvent.contextMenu(screen.getByText('terminal'))

    await screen.findByTestId(TestIds.terminalContextMenu)
    fireEvent.click(screen.getByTestId(TestIds.terminalContextCopy))
    fireEvent.click(screen.getByTestId(TestIds.terminalContextPaste))
    fireEvent.click(screen.getByTestId(TestIds.terminalContextPasteImage))
    fireEvent.click(screen.getByTestId(TestIds.terminalContextAttachFile))
    fireEvent.click(screen.getByTestId(TestIds.terminalContextSelectAll))
    fireEvent.click(screen.getByTestId(TestIds.terminalContextClear))

    expect(copySelection).toHaveBeenCalledWith('s1')
    expect(pasteClipboard).toHaveBeenCalledWith('s1')
    expect(pasteImage).toHaveBeenCalledWith('s1')
    expect(chooseFiles).toHaveBeenCalledWith('s1')
    expect(selectAll).toHaveBeenCalledWith('s1')
    expect(clearViewport).toHaveBeenCalledWith('s1')
  })

  it('disables Copy when xterm has no selection, preserving Ctrl-C interrupt behaviour', () => {
    selectionText.mockReturnValue('')
    render(
      <TerminalContextMenu sessionId="s1">
        <div>terminal</div>
      </TerminalContextMenu>,
    )
    fireEvent.contextMenu(screen.getByText('terminal'))
    expect(screen.getByTestId(TestIds.terminalContextCopy)).toBeDisabled()
  })
})
