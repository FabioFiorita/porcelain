import { Text, View } from 'react-native'

import { EmptyNote, ErrorNote, StatusNote } from '@/components/panel-chrome'
import { SurfaceList } from '@/components/surface-scroll'
import type { Commit } from '@/lib/daemon/procedures/changes'

import { CommitRow, type CommitRowActions } from './commit-row'
import { useHistoryStore } from './history-store'
import { useCommitActions } from './use-commit-actions'
import { useGitLog, useHeadLabel } from './use-history'

/**
 * The History list: commits on the checked-out branch, newest first.
 *
 * Row taps hand the hash up to `onOpenCommit`, which the phone turns into a stack push and the
 * tablet into a viewer selection. The list stays ignorant of which — the same split the
 * Changes list makes.
 */
export function HistoryList({
  active,
  onOpenCommit,
}: {
  active: boolean
  /** Phone: push the commit's route. Omitted on tablet, which selects into its viewer. */
  onOpenCommit?: (hash: string) => void
}): React.JSX.Element {
  const selection = useHistoryStore((state) => state.selection)
  const selectCommit = useHistoryStore((state) => state.openCommit)
  const openCommit = onOpenCommit ?? selectCommit
  const { commits, error, isLoading } = useGitLog(active)
  const branch = useHeadLabel(active)
  const { copyHash, copyMessage, status } = useCommitActions()

  const actions: CommitRowActions = {
    onCopyHash: copyHash,
    onCopyMessage: copyMessage,
    onOpen: openCommit,
  }

  // Until the first read lands there is no honest count to print — "0 commits" would read as
  // an empty repo.
  const pending = isLoading && commits === undefined
  const selectedHash = selection?.hash ?? null

  return (
    <View className="flex-1" testID="porcelain-history-list">
      <HistoryHeader
        branch={branch}
        pending={pending}
        status={status}
        total={commits?.length ?? 0}
      />

      {error !== null ? (
        <View className="px-4 pb-2">
          <ErrorNote message={error.message} testID="porcelain-history-error" />
        </View>
      ) : null}

      {pending ? (
        <Text
          className="px-4 py-6 text-sm text-muted-foreground"
          testID="porcelain-history-loading"
        >
          Loading commits…
        </Text>
      ) : (commits ?? []).length === 0 && error === null ? (
        <EmptyNote
          body="Commits on this branch will show up here as you work."
          testID="porcelain-history-empty"
          title="No commits yet"
        />
      ) : (
        <SurfaceList
          data={commits ?? []}
          gap={2}
          initialNumToRender={20}
          keyExtractor={(commit: Commit) => commit.hash}
          renderItem={({ item }) => (
            <CommitRow actions={actions} commit={item} selected={item.hash === selectedHash} />
          )}
          testID="porcelain-history-rows"
          windowSize={9}
        />
      )}
    </View>
  )
}

function HistoryHeader({
  branch,
  pending,
  status,
  total,
}: {
  branch: string | null
  pending: boolean
  status: { text: string; failed: boolean } | null
  total: number
}): React.JSX.Element {
  const noun = total === 1 ? 'commit' : 'commits'
  const on = branch === null ? '' : ` on ${branch}`

  return (
    <View className="gap-1 px-4 pb-2 pt-3">
      <Text className="text-xs text-muted-foreground" testID="porcelain-history-summary">
        {pending ? 'Loading commits…' : `${total} ${noun}${on}`}
      </Text>
      {status === null ? null : (
        <StatusNote
          failed={status.failed}
          testID="porcelain-history-action-status"
          text={status.text}
        />
      )}
    </View>
  )
}
