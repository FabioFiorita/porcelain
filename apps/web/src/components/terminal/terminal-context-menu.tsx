import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Kbd } from '@renderer/components/ui/kbd'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { kbdLabel } from '@renderer/lib/keyboard'
import {
  chooseTerminalFiles,
  clearTerminalViewport,
  copyTerminalSelection,
  pasteTerminalClipboard,
  pasteTerminalImage,
  selectAllTerminal,
  terminalSelectionText,
} from '@renderer/lib/terminal-registry'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { ClipboardPaste, Copy, Eraser, FilePlus2, ImageIcon, TextSelect } from 'lucide-react'
import { useState } from 'react'

/**
 * Host-level terminal commands. The component knows no renderer details; the registry
 * maps these product actions onto Ghostty today and the next terminal surface tomorrow.
 */
export function TerminalContextMenu({
  sessionId,
  children,
}: {
  sessionId: string
  children: React.ReactNode
}): React.JSX.Element {
  const [selection, setSelection] = useState('')

  return (
    <ContextMenu
      onOpenChange={(open: boolean): void => {
        if (open) setSelection(terminalSelectionText(sessionId))
      }}
    >
      <ContextMenuTrigger className="block min-h-0 flex-1">{children}</ContextMenuTrigger>
      <ContextMenuContent data-testid={TestIds.terminalContextMenu} className="w-52">
        <ContextMenuItem
          data-testid={TestIds.terminalContextCopy}
          disabled={selection === ''}
          onClick={() => {
            runUserAction(
              async () => {
                await copyTerminalSelection(sessionId)
              },
              (error) => {
                toastUserActionError('Copy selection', error)
              },
            )
          }}
        >
          <Copy /> Copy
          <ContextMenuShortcut>
            <Kbd>{kbdLabel('mod', 'C')}</Kbd>
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          data-testid={TestIds.terminalContextPaste}
          onClick={() => {
            runUserAction(
              async () => {
                await pasteTerminalClipboard(sessionId)
              },
              (error) => {
                toastUserActionError('Paste', error)
              },
            )
          }}
        >
          <ClipboardPaste /> Paste
          <ContextMenuShortcut>
            <Kbd>{kbdLabel('mod', 'V')}</Kbd>
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          data-testid={TestIds.terminalContextPasteImage}
          onClick={() => {
            runUserAction(
              async () => {
                await pasteTerminalImage(sessionId)
              },
              (error) => {
                toastUserActionError('Paste image', error)
              },
            )
          }}
        >
          <ImageIcon /> Paste image
          <ContextMenuShortcut>
            <Kbd>{kbdLabel('mod', 'shift', 'V')}</Kbd>
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          data-testid={TestIds.terminalContextAttachFile}
          onClick={() => chooseTerminalFiles(sessionId)}
        >
          <FilePlus2 /> Attach file
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          data-testid={TestIds.terminalContextSelectAll}
          onClick={() => selectAllTerminal(sessionId)}
        >
          <TextSelect /> Select all
          <ContextMenuShortcut>
            <Kbd>{kbdLabel('mod', 'A')}</Kbd>
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          data-testid={TestIds.terminalContextClear}
          onClick={() => clearTerminalViewport(sessionId)}
        >
          <Eraser /> Clear
          <ContextMenuShortcut>
            <Kbd>{kbdLabel('mod', 'K')}</Kbd>
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
