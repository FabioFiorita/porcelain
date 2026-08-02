import { Button, List, Section, Text } from '@expo/ui/swift-ui'
import { router } from 'expo-router'

import type { FeatureReading, ReviewComment } from '@/lib/daemon/procedures/review'
import { FileRow } from './file-row'
import { useReviewComments } from './hooks/use-review-comments'
import { useReviewedActions } from './hooks/use-reviewed'
import { executionGroups } from './review-outline'

export function ExecutionFace({
  reading,
  reviewedPaths,
}: {
  reading: FeatureReading
  reviewedPaths: readonly string[]
}): React.JSX.Element {
  const comments = useReviewComments()
  const reviewedActions = useReviewedActions()
  const groups = executionGroups(reading)
  const reviewed = new Set(reviewedPaths)
  const commentsByPath = new Map<string, ReviewComment[]>()
  for (const comment of comments.data ?? []) {
    const current = commentsByPath.get(comment.path) ?? []
    current.push(comment)
    commentsByPath.set(comment.path, current)
  }

  if (groups.length === 0) {
    return (
      <List>
        <Section>
          <Text>
            No files in this Review yet. Execution grows as the agent publishes its file set.
          </Text>
          <Button
            label="View all comments"
            onPress={(): void => router.push('/comments')}
            systemImage="text.bubble"
          />
        </Section>
      </List>
    )
  }

  return (
    <List>
      {groups.map((group) => (
        <Section key={group.layer} title={group.layer}>
          {group.files.map((file) => (
            <FileRow
              comments={commentsByPath.get(file.path) ?? []}
              file={file}
              key={file.path}
              onToggleReviewed={(): void => {
                const action = reviewed.has(file.path)
                  ? reviewedActions.unmark(file.path)
                  : reviewedActions.mark(file.path)
                action.catch(() => {})
              }}
              reviewed={reviewed.has(file.path)}
            />
          ))}
        </Section>
      ))}
    </List>
  )
}
