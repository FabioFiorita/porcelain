import { memo, useEffect, useRef, useState } from 'react'
import { LayoutAnimation, Text, View } from 'react-native'
import type { EntryActions } from './file-entry-row'
import { FileEntryRow } from './file-entry-row'
import type { FileEntry } from './files-data'
import { useDirEntries } from './files-data'
import { useFilesStore } from './files-store'

function TreeEntryImpl({
  actions,
  active,
  collapseNonce,
  depth,
  entry,
  onOpenFile,
  selectedPath,
  onReveal,
}: {
  actions: EntryActions
  active: boolean
  collapseNonce: number
  depth: number
  entry: FileEntry
  onOpenFile: (path: string) => void
  selectedPath: string | null
  onReveal?: (row: View) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const revealPath = useFilesStore((s) => s.revealPath)
  const revealNonce = useFilesStore((s) => s.revealNonce)
  const multiSelected = useFilesStore((s) => s.selectedPaths.includes(entry.path))
  const rowRef = useRef<View>(null)
  useEffect(() => {
    if (revealNonce === 0 || revealPath !== entry.path || !onReveal) return
    const frame = requestAnimationFrame(() => {
      if (rowRef.current) onReveal(rowRef.current)
    })
    return () => cancelAnimationFrame(frame)
  }, [revealPath, revealNonce, entry.path, onReveal])
  useEffect(() => {
    if (revealNonce > 0 && (revealPath === entry.path || revealPath?.startsWith(`${entry.path}/`)))
      setExpanded(true)
  }, [revealPath, revealNonce, entry.path])
  const seenCollapse = useRef(collapseNonce)
  const children = useDirEntries(entry.path, active && expanded && entry.kind === 'dir')

  useEffect(() => {
    if (seenCollapse.current === collapseNonce) return
    seenCollapse.current = collapseNonce
    setExpanded(false)
  }, [collapseNonce])

  return (
    <View ref={rowRef} collapsable={false}>
      <FileEntryRow
        actions={actions}
        compact
        depth={depth}
        entry={entry}
        expanded={entry.kind === 'dir' ? expanded : undefined}
        selected={entry.path === selectedPath || multiSelected}
        onPress={() => {
          if (entry.kind === 'dir') {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
            setExpanded((value) => !value)
          } else onOpenFile(entry.path)
        }}
      />
      {entry.kind !== 'dir' || !expanded ? null : children.isLoading ? (
        <View style={{ paddingLeft: (depth + 1) * 14 }}>
          <Text className="px-4 py-1 text-2xs text-muted-foreground">Reading…</Text>
        </View>
      ) : children.error !== null ? (
        <View style={{ paddingLeft: (depth + 1) * 14 }}>
          <Text className="px-4 py-1 text-2xs text-destructive">{children.error.message}</Text>
        </View>
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
            onReveal={onReveal}
          />
        ))
      )}
    </View>
  )
}
const TreeEntry = memo(TreeEntryImpl)

/** Lazy, persistent file tree matching the web Files rail. */
export function FilesTree({
  actions,
  active,
  collapseNonce,
  entries,
  onOpenFile,
  selectedPath,
  onReveal,
}: {
  actions: EntryActions
  active: boolean
  collapseNonce: number
  entries: readonly FileEntry[]
  onOpenFile: (path: string) => void
  selectedPath: string | null
  onReveal?: (row: View) => void
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
          onReveal={onReveal}
        />
      ))}
    </View>
  )
}
