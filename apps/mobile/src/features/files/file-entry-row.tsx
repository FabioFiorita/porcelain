import { memo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { ActionSheet, type SheetAction } from '@/components/panel-chrome'
import { SURFACE_ROW, SURFACE_ROW_SELECTED } from '@/components/surface-layout'
import { cn } from '@/lib/utils'

import { pathTestId } from './file-paths'
import type { FileEntry } from './use-files'

export type EntryActions = {
  onOpen: (entry: FileEntry) => void
  onComment: (path: string) => void
  onSetPinned: (path: string, pinned: boolean) => void
  onSetHidden: (path: string, hidden: boolean) => void
  /**
   * The working-tree writes. The row only says which entry the reader pointed at; the browser
   * owns the prompt and the confirmation, so the tree holds one of each rather than one per row.
   */
  onCreateFile: (entry: FileEntry) => void
  onCreateFolder: (entry: FileEntry) => void
  onRename: (entry: FileEntry) => void
  onDuplicate: (entry: FileEntry) => void
  onTrash: (entry: FileEntry) => void
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'ico'])
const CODE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'swift',
  'kt',
  'java',
  'rb',
  'go',
  'rs',
  'py',
  'sh',
  'zsh',
  'css',
])

/**
 * The row's glyph. Three buckets rather than the web's full icon set: at this size the useful
 * signal is "folder / picture / code / other", and a per-language icon would be noise.
 */
function glyphFor(entry: FileEntry): ChromeIconName {
  if (entry.kind === 'dir') return 'folderFill'
  const extension = entry.name.split('.').at(-1)?.toLowerCase() ?? ''
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (CODE_EXTENSIONS.has(extension)) return 'code'
  return 'file'
}

/**
 * One directory entry.
 *
 * Tap opens — a folder drills in, a file opens in the viewer — so the row's one tap target
 * does the one obvious thing. Everything the desktop puts behind a right-click lives behind a
 * long press instead: create beside it, rename, duplicate, trash, pin it to the companion,
 * hide it from the tree, comment on it.
 */
function FileEntryRowImpl({
  actions,
  entry,
  selected,
}: {
  actions: EntryActions
  entry: FileEntry
  selected: boolean
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)

  // A folder takes new entries inside it; a file's siblings go beside it. Saying so on the
  // label is cheaper than making the reader guess where the file they just made went.
  const into = entry.kind === 'dir' ? entry.name : 'this folder'

  const menuActions: SheetAction[] = [
    {
      glyph: 'plus',
      id: 'new-file',
      label: `New file in ${into}`,
      onPress: () => {
        actions.onCreateFile(entry)
      },
    },
    {
      glyph: 'folder',
      id: 'new-folder',
      label: `New folder in ${into}`,
      onPress: () => {
        actions.onCreateFolder(entry)
      },
    },
    {
      glyph: 'pencil',
      id: 'rename',
      label: 'Rename',
      onPress: () => {
        actions.onRename(entry)
      },
    },
    {
      glyph: 'copy',
      id: 'duplicate',
      label: 'Duplicate',
      onPress: () => {
        actions.onDuplicate(entry)
      },
    },
    {
      glyph: entry.pinned ? 'pinOff' : 'pin',
      id: 'pin',
      label: entry.pinned ? 'Unpin' : 'Pin to companion',
      onPress: () => {
        actions.onSetPinned(entry.path, !entry.pinned)
      },
    },
    {
      glyph: entry.hidden ? 'eye' : 'eyeOff',
      id: 'hidden',
      label: entry.hidden ? 'Unhide' : 'Hide from the tree',
      onPress: () => {
        actions.onSetHidden(entry.path, !entry.hidden)
      },
    },
  ]
  if (entry.kind === 'file') {
    menuActions.push({
      glyph: 'commentAdd',
      id: 'comment',
      label: 'Comment on file',
      onPress: () => {
        actions.onComment(entry.path)
      },
    })
  }
  // Last, and the only destructive one: the trash is recoverable, but a mis-tap next to
  // "Duplicate" still costs a trip to Finder.
  menuActions.push({
    destructive: true,
    glyph: 'trash',
    id: 'trash',
    label: 'Move to Trash…',
    onPress: () => {
      actions.onTrash(entry)
    },
  })

  return (
    <View>
      <Pressable
        accessibilityLabel={`${entry.kind === 'dir' ? 'Folder' : 'File'} ${entry.name}${
          entry.pinned ? ', pinned' : ''
        }${entry.hidden ? ', hidden' : ''}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className={cn(
          'min-h-11 flex-row items-center gap-2.5',
          SURFACE_ROW,
          selected && SURFACE_ROW_SELECTED,
          // A hidden row is only on screen because the scope override is on; keep it legible
          // but obviously out of scope.
          entry.hidden && 'opacity-50',
        )}
        testID={pathTestId('porcelain-files-entry', entry.path)}
        onLongPress={() => {
          setMenuOpen(true)
        }}
        onPress={() => {
          actions.onOpen(entry)
        }}
      >
        <ChromeGlyph
          name={glyphFor(entry)}
          size={16}
          tone={entry.kind === 'dir' ? 'primary' : 'muted'}
        />
        <Text className="min-w-0 flex-1 font-mono text-[13px] text-foreground" numberOfLines={1}>
          {entry.name}
        </Text>
        {entry.pinned ? <ChromeGlyph name="pin" size={11} tone="primary" /> : null}
        {entry.kind === 'dir' ? <ChromeGlyph name="chevronRight" size={12} /> : null}
      </Pressable>

      <ActionSheet
        actions={menuActions}
        open={menuOpen}
        subtitle={entry.path}
        testID="porcelain-files-entry-menu"
        title={entry.name}
        onClose={() => {
          setMenuOpen(false)
        }}
      />
    </View>
  )
}

/** Memoized: a watched directory redraws whenever the agent writes anywhere inside it. */
export const FileEntryRow = memo(FileEntryRowImpl)
