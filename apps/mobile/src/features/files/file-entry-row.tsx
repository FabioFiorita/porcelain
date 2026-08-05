import { memo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { ActionSheet, type SheetAction } from '@/components/panel-chrome'
import { cn } from '@/lib/utils'

import { pathTestId } from './file-paths'
import type { FileEntry } from './use-files'

export type EntryActions = {
  onOpen: (entry: FileEntry) => void
  onComment: (path: string) => void
  onSetPinned: (path: string, pinned: boolean) => void
  onSetHidden: (path: string, hidden: boolean) => void
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
 * long press instead: pin it to the companion, hide it from the tree, comment on it.
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

  const menuActions: SheetAction[] = [
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

  return (
    <View>
      <Pressable
        accessibilityLabel={`${entry.kind === 'dir' ? 'Folder' : 'File'} ${entry.name}${
          entry.pinned ? ', pinned' : ''
        }${entry.hidden ? ', hidden' : ''}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className={cn(
          'min-h-11 flex-row items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 active:bg-accent',
          selected && 'border-border bg-muted/70',
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
