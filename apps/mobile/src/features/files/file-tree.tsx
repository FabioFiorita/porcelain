import { setStringAsync } from 'expo-clipboard'
import { type Href, router } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { ActionSheetIOS } from 'react-native'

import { EntryCanvas } from '@/components/entry-canvas'
import type { EntryItem, EntryTarget } from '@/components/entry-rows'
import type { DirEntry } from '@/lib/daemon/procedures/files'
import { entryHref, hrefForAbsolutePath, repoRelativePath } from './file-paths'
import { FilesLoading, FilesQueryState, NoVisibleFiles } from './files-empty-states'
import { useFileTree } from './use-file-tree'
import { type FileEntryActions, useFileEntryActions, usePinnedFileEntries } from './use-files'

const PINNED_PREFIX = 'pinned:'

/**
 * The repository, as a tree. Folders open in place instead of pushing a screen: the reader keeps
 * the shape of where they are, which is the whole point of a file tree and the one thing a
 * drill-down listing cannot give. Pinned entries ride above it and reveal into it when tapped.
 */
export function FileTree({
  repoPath,
  rootPath,
  showHidden,
  showPinned = false,
}: {
  repoPath: string
  rootPath: string
  showHidden: boolean
  showPinned?: boolean
}): React.JSX.Element {
  const tree = useFileTree({ enabled: true, repoPath, rootPath, showHidden })
  const pinned = usePinnedFileEntries(repoPath, showPinned)
  const actions = useFileEntryActions(repoPath)
  const [revealKey, setRevealKey] = useState<string | null>(null)

  const pinnedEntries = useMemo(
    (): DirEntry[] =>
      showPinned ? (pinned.data ?? []).filter((entry) => showHidden || !entry.hidden) : [],
    [pinned.data, showHidden, showPinned],
  )

  const items = useMemo((): EntryItem[] => {
    if (pinnedEntries.length === 0) return tree.items
    return [
      { key: 'section:pinned', kind: 'section', title: 'Pinned' },
      ...pinnedEntries.map(
        (entry): EntryItem => ({
          depth: 0,
          dimmed: entry.hidden,
          key: `${PINNED_PREFIX}${entry.path}`,
          kind: entry.kind === 'dir' ? 'dir' : 'file',
          name: entry.name,
          path: entry.path,
        }),
      ),
      { key: 'section:files', kind: 'section', title: 'Files' },
      ...tree.items,
    ]
  }, [pinnedEntries, tree.items])

  const openFile = useCallback(
    (path: string): void => {
      router.push(fileHref(repoPath, path))
    },
    [repoPath],
  )

  const handlePress = useCallback(
    (item: EntryTarget): void => {
      if (item.kind === 'item') return
      // A pinned row is a shortcut into the tree, not a second place to browse: a folder reveals
      // and scrolls to its real row, a file opens.
      if (item.key.startsWith(PINNED_PREFIX)) {
        if (item.kind === 'file') {
          openFile(item.path)
          return
        }
        tree.reveal(item.path)
        setRevealKey(item.path)
        return
      }
      if (item.kind === 'dir') {
        tree.toggle(item.path)
        return
      }
      openFile(item.path)
    },
    [openFile, tree],
  )

  const handleLongPress = useCallback(
    (item: EntryTarget): void => {
      if (item.kind === 'item') return
      showEntryMenu(entryFor(item, pinnedEntries), actions)
    },
    [actions, pinnedEntries],
  )

  const refresh = useCallback((): void => {
    Promise.all([tree.refresh(), showPinned ? pinned.refetch() : Promise.resolve()]).catch(() => {
      // A failed refresh leaves the last listing on screen; the error state covers a cold tree.
    })
  }, [pinned, showPinned, tree])

  if (tree.items.length === 0) {
    if (tree.error !== null) {
      return (
        <FilesQueryState
          description="The listing will update when the daemon is reachable again."
          error={tree.error}
          onRetry={refresh}
          title="Could not read this repo"
        />
      )
    }
    if (tree.isPending) return <FilesLoading />
    if (pinnedEntries.length === 0) return <NoVisibleFiles />
  }

  return (
    <EntryCanvas
      contentKey={`files:${rootPath}`}
      disclosure
      items={items}
      onLongPress={handleLongPress}
      onPress={handlePress}
      onRefresh={refresh}
      refreshing={tree.isPending}
      revealKey={revealKey}
    />
  )
}

function fileHref(repoPath: string, path: string): Href {
  const relative = repoRelativePath(repoPath, path)
  return relative === null || relative === ''
    ? hrefForAbsolutePath(repoPath, path, 'file')
    : entryHref('file', relative)
}

/** Pin and hide state lives on the daemon's entry, which a pinned row carries and a tree row not. */
function entryFor(
  item: Extract<EntryItem, { kind: 'dir' | 'file' }>,
  pinnedEntries: readonly DirEntry[],
): { path: string; pinned: boolean; hidden: boolean } {
  const pinned = pinnedEntries.some((entry) => entry.path === item.path)
  return { hidden: item.dimmed === true, path: item.path, pinned }
}

function showEntryMenu(
  entry: { path: string; pinned: boolean; hidden: boolean },
  actions: FileEntryActions,
): void {
  const pinLabel = entry.pinned ? 'Unpin' : 'Pin'
  const hideLabel = entry.hidden ? 'Unhide' : 'Hide'
  const options = [pinLabel, hideLabel, 'Copy path', 'Cancel']

  ActionSheetIOS.showActionSheetWithOptions(
    { cancelButtonIndex: options.length - 1, options, title: entry.path },
    (index: number): void => {
      if (index === 0) {
        if (entry.pinned) actions.unpin(entry.path)
        else actions.pin(entry.path)
        return
      }
      if (index === 1) {
        if (entry.hidden) actions.unhide(entry.path)
        else actions.hide(entry.path)
        return
      }
      if (index === 2) {
        setStringAsync(entry.path).catch(() => {
          // Clipboard access is best effort; the sheet still dismisses cleanly.
        })
      }
    },
  )
}
