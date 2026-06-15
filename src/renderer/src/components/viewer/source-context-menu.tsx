import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Kbd } from '@renderer/components/ui/kbd'
import { Compass, Copy, FileSymlink, FolderOpen, Link2, Search } from 'lucide-react'
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
  const { copyPath, copyRelativePath, reveal, findReferences, exploreFlow } = usePathActions(path)

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) setSelection(window.getSelection()?.toString() ?? '')
      }}
    >
      {/* the ui trigger defaults to select-none; the viewer must stay selectable */}
      <ContextMenuTrigger className="block h-full select-text">{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {selection !== '' ? (
          <>
            <ContextMenuItem onClick={() => navigator.clipboard.writeText(selection)}>
              <Copy /> Copy
              <ContextMenuShortcut>
                <Kbd>⌘C</Kbd>
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              disabled={selection.trim() === ''}
              onClick={() => findReferences(selection)}
            >
              <Search /> Find references
            </ContextMenuItem>
            <ContextMenuItem
              disabled={selection.trim() === ''}
              onClick={() => exploreFlow(selection)}
            >
              <Compass /> Explore flow from “{selection.trim().slice(0, 24)}”
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuItem onClick={copyPath}>
              <Link2 /> Copy path
            </ContextMenuItem>
            <ContextMenuItem onClick={copyRelativePath}>
              <FileSymlink /> Copy relative path
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={reveal}>
              <FolderOpen /> Reveal in Finder
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
