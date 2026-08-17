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
import { isBrowser } from '@renderer/lib/platform'
import { copyText } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import { Copy, FileSymlink, FolderOpen, Link2, Search } from 'lucide-react'
import { useState } from 'react'
import { usePathActions } from './use-path-actions'

export function SourceContextMenu({
  path,
  children,
}: {
  path: string
  children: React.ReactNode
}): React.JSX.Element {
  const [selection, setSelection] = useState('')
  const { copyPath, copyRelativePath, reveal, findReferences } = usePathActions(path)

  return (
    <ContextMenu
      onOpenChange={(open: boolean): void => {
        if (open) {
          setSelection(window.getSelection()?.toString() ?? '')
        }
      }}
    >
      {/* the ui trigger defaults to select-none; the viewer must stay selectable */}
      <ContextMenuTrigger className="block h-full select-text">{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {selection !== '' ? (
          <>
            <ContextMenuItem
              onClick={() => {
                runUserAction(
                  () => copyText(selection),
                  (error) => {
                    toastUserActionError('Copy', error)
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
              disabled={selection.trim() === ''}
              onClick={() => findReferences(selection)}
            >
              <Search /> Find references
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                copyPath()
              }}
            >
              <Link2 /> Copy path
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                copyRelativePath()
              }}
            >
              <FileSymlink /> Copy relative path
            </ContextMenuItem>
            {/* Reveal in Finder is a shell-only action — hidden in the browser client. */}
            {!isBrowser && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => {
                    reveal()
                  }}
                >
                  <FolderOpen /> Reveal in Finder
                </ContextMenuItem>
              </>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
