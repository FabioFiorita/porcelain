import { type Href, router } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'

import { EntryCanvas } from '@/components/entry-canvas'
import type { EntryItem, EntryTarget } from '@/components/entry-rows'
import type { DirEntry } from '@/lib/daemon/procedures/files'
import type { EntryMenuState } from './entry-menu'
import { entryHref, hrefForAbsolutePath, repoRelativePath } from './file-paths'
import { FilesLoading, FilesQueryState, NoVisibleFiles } from './files-empty-states'
import { showEntryMenu } from './show-entry-menu'
import { useFileTree } from './use-file-tree'
import { useFileEntryActions, usePinnedFileEntries } from './use-files'

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
      showEntryMenu(entryFor(item, tree.entryAt(item.path), pinnedEntries), actions)
    },
    [actions, pinnedEntries, tree],
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
      refreshing={tree.isFetching || pinned.isFetching}
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

/**
 * Pin and hide state lives on the daemon's entry, not on the drawn row. The tree's own listing
 * is the source: the pinned section is only rendered at the repo root, so deriving pin state
 * from it left every deep-linked folder unable to unpin what it was showing as pinned.
 */
function entryFor(
  item: Extract<EntryItem, { kind: 'dir' | 'file' }>,
  treeEntry: DirEntry | undefined,
  pinnedEntries: readonly DirEntry[],
): EntryMenuState {
  if (treeEntry !== undefined) {
    return { hidden: treeEntry.hidden, path: treeEntry.path, pinned: treeEntry.pinned }
  }
  // A pinned-section row whose folder is not open in the tree below it.
  const pinnedEntry = pinnedEntries.find((entry) => entry.path === item.path)
  if (pinnedEntry !== undefined) {
    return { hidden: pinnedEntry.hidden, path: pinnedEntry.path, pinned: pinnedEntry.pinned }
  }
  return { hidden: item.dimmed === true, path: item.path, pinned: false }
}
