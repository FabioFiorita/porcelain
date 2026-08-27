import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'

import type { EntryActions } from './file-entry-row'
import { FileEntryRow } from './file-entry-row'
import type { FileEntry } from './files-data'
import { useDirEntries } from './files-data'

function TreeEntry({
  actions,
  active,
  collapseNonce,
  depth,
  entry,
  onOpenFile,
  selectedPath,
}: {
  actions: EntryActions
  active: boolean
  collapseNonce: number
  depth: number
  entry: FileEntry
  onOpenFile: (path: string) => void
  selectedPath: string | null
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const seenCollapse = useRef(collapseNonce)
  const children = useDirEntries(entry.path, active && expanded && entry.kind === 'dir')

  useEffect(() => {
    if (seenCollapse.current === collapseNonce) return
    seenCollapse.current = collapseNonce
    setExpanded(false)
  }, [collapseNonce])

  return (
    <View>
      <FileEntryRow
        actions={actions}
        compact
        depth={depth}
        entry={entry}
        expanded={entry.kind === 'dir' ? expanded : undefined}
        selected={entry.path === selectedPath}
        onPress={() => {
          if (entry.kind === 'dir') setExpanded((value) => !value)
          else onOpenFile(entry.path)
        }}
      />
      {entry.kind !== 'dir' || !expanded ? null : children.isLoading ? (
        <Text className="px-4 py-1 text-2xs text-muted-foreground">Reading…</Text>
      ) : children.error !== null ? (
        <Text className="px-4 py-1 text-2xs text-destructive">{children.error.message}</Text>
      ) : (
        children.entries.map((child) => (
          <TreeEntry
            key={child.path}
            actions={actions}
            active={active}
            collapseNonce={collapseNonce}
            depth={depth + 1}
            entry={child}
            onOpenFile={onOpenFile}
            selectedPath={selectedPath}
          />
        ))
      )}
    </View>
  )
}

/** Lazy, persistent file tree matching the web Files rail. */
export function FilesTree({
  actions,
  active,
  collapseNonce,
  entries,
  onOpenFile,
  selectedPath,
}: {
  actions: EntryActions
  active: boolean
  collapseNonce: number
  entries: readonly FileEntry[]
  onOpenFile: (path: string) => void
  selectedPath: string | null
}): React.JSX.Element {
  return (
    <View className="pb-2" testID="porcelain-files-tree">
      {entries.map((entry) => (
        <TreeEntry
          key={entry.path}
          actions={actions}
          active={active}
          collapseNonce={collapseNonce}
          depth={0}
          entry={entry}
          onOpenFile={onOpenFile}
          selectedPath={selectedPath}
        />
      ))}
    </View>
  )
}
