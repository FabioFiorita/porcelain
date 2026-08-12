import { View } from 'react-native'

import { EmptyNote } from '@/components/panel-chrome'
import { DiffView } from '@/features/diff/diff-view'
import { ReadAllView } from '@/features/diff/read-all-view'
import { useFilesStore } from '@/features/files'
import { useCommitMessage } from '@/features/git'
import { useShellStore } from '@/features/shell/shell-store'

import { commitTitle, shortHash } from './commit-message'
import { CommitView } from './commit-view'
import { useHistoryStore } from './history-store'

/**
 * The tablet's viewer column: the commit the list last selected, and — one level in — a single
 * file's diff or the whole commit as a continuous read.
 *
 * The column is a SplitView slot the route does not own, so there is nothing here to push:
 * the store is the stack, and the back chevron pops it. The phone reaches these same three
 * views through real routes, which is what earns it the interactive pop gesture and the
 * hardware back button.
 */
export function HistoryViewer({ active }: { active: boolean }): React.JSX.Element {
  const selection = useHistoryStore((state) => state.selection)
  const openAll = useHistoryStore((state) => state.openAll)
  const openFile = useHistoryStore((state) => state.openFile)
  const closeFile = useHistoryStore((state) => state.closeFile)
  const openCurrentFile = (path: string): void => {
    useFilesStore.getState().openFile(path)
    useShellStore.getState().setActiveSurface('files')
  }
  // Hooks cannot be conditional, and the read is disabled until a commit is actually open.
  const hash = selection?.hash ?? ''
  const message = useCommitMessage(hash, active && hash !== '')

  if (selection === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <EmptyNote
          body="Pick a commit to read its message and the files it changed."
          testID="porcelain-history-viewer-empty"
          title="No commit open"
        />
      </View>
    )
  }

  if (selection.kind === 'file') {
    return (
      <DiffView
        active={active}
        filePath={selection.path}
        source={{ hash: selection.hash, kind: 'commit' }}
        testID="porcelain-history-diff"
        commentTestIDPrefix="porcelain-history-comment"
        selectionTestIDPrefix="porcelain-history-selection"
        onBack={closeFile}
        onOpenFile={openCurrentFile}
      />
    )
  }

  if (selection.kind === 'all') {
    return (
      <ReadAllView
        active={active}
        context={shortHash(selection.hash)}
        scope={{ hash: selection.hash, type: 'commit' }}
        testID="porcelain-history-read-all"
        commentTestIDPrefix="porcelain-history-comment"
        selectionTestIDPrefix="porcelain-history-selection"
        title={commitTitle(message, selection.hash)}
        onBack={closeFile}
      />
    )
  }

  return (
    <CommitView active={active} hash={selection.hash} onOpenAll={openAll} onOpenFile={openFile} />
  )
}
