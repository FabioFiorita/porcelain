import {
  Alert,
  Button,
  DisclosureGroup,
  HStack,
  List,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui'
import { buttonStyle, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'
import { useState } from 'react'
import { ScreenHost } from '@/components/screen-host'
import { QueryNotice } from '@/features/changes/components/query-notice'
import type { ReviewComment } from '@/lib/daemon/procedures/review'

import { useReviewCommentActions, useReviewComments } from './hooks/use-review-comments'

export function CommentsScreen(): React.JSX.Element {
  const query = useReviewComments()
  const actions = useReviewCommentActions()
  const [resolvedExpanded, setResolvedExpanded] = useState(false)
  const unresolved = (query.data ?? []).filter((comment) => !comment.resolved)
  const resolved = (query.data ?? []).filter((comment) => comment.resolved)
  const groups = groupByPath(unresolved)

  return (
    <ScreenHost>
      <List>
        {query.data === undefined ? (
          <Section>
            <QueryNotice
              description="Reading file comments from the daemon."
              error={query.error}
              isPending={query.isPending}
              onRetry={(): void => {
                query.refetch()
              }}
              symbol="text.alignleft"
              title="No comments"
            />
          </Section>
        ) : null}
        {query.data !== undefined && groups.size === 0 ? (
          <Section>
            <Text>No open comments. Add a note from an Execution file row.</Text>
          </Section>
        ) : null}
        {[...groups.entries()].map(([path, comments]) => (
          <Section key={path} title={path}>
            {comments.map((comment) => (
              <CommentItem comment={comment} key={comment.id} onDelete={actions.remove} />
            ))}
          </Section>
        ))}
        {resolved.length === 0 ? null : (
          <Section title="Resolved">
            <DisclosureGroup
              isExpanded={resolvedExpanded}
              label={`${resolved.length} resolved comment${resolved.length === 1 ? '' : 's'}`}
              onIsExpandedChange={setResolvedExpanded}
            >
              {resolved.map((comment) => (
                <CommentItem comment={comment} key={comment.id} onDelete={actions.remove} />
              ))}
            </DisclosureGroup>
          </Section>
        )}
      </List>
    </ScreenHost>
  )
}

function groupByPath(comments: readonly ReviewComment[]): Map<string, ReviewComment[]> {
  const groups = new Map<string, ReviewComment[]>()
  for (const comment of comments) {
    const current = groups.get(comment.path) ?? []
    current.push(comment)
    groups.set(comment.path, current)
  }
  return groups
}

function CommentItem({
  comment,
  onDelete,
}: {
  comment: ReviewComment
  onDelete: (id: string) => Promise<void>
}): React.JSX.Element {
  const [deletePresented, setDeletePresented] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function remove(): Promise<void> {
    setDeleting(true)
    try {
      await onDelete(comment.id)
      setDeletePresented(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <VStack alignment="leading" spacing={6}>
      <HStack alignment="top" spacing={8}>
        <Text modifiers={[font({ textStyle: 'body' })]}>{comment.body}</Text>
        <Spacer />
        <Button
          label="Edit"
          modifiers={[buttonStyle('borderless')]}
          onPress={(): void =>
            router.push({
              params: { body: comment.body, id: comment.id, path: comment.path },
              pathname: '/comment',
            })
          }
        />
      </HStack>
      {comment.agentReply === undefined ? null : (
        <Text
          modifiers={[
            font({ textStyle: 'footnote' }),
            foregroundStyle({ color: '#34C759', type: 'color' }),
          ]}
        >
          {`Agent reply: ${comment.agentReply.body}`}
        </Text>
      )}
      <HStack spacing={8}>
        {comment.resolved ? (
          <Text modifiers={[font({ textStyle: 'caption2' })]}>Resolved</Text>
        ) : null}
        <Button
          label={deleting ? 'Deleting…' : 'Delete'}
          modifiers={[buttonStyle('borderless')]}
          onPress={(): void => setDeletePresented(true)}
        />
      </HStack>
      <Alert
        isPresented={deletePresented}
        onIsPresentedChange={setDeletePresented}
        title="Delete this comment?"
      >
        <Alert.Message>
          <Text>This cannot be undone.</Text>
        </Alert.Message>
        <Alert.Actions>
          <Button label="Cancel" role="cancel" />
          <Button
            label="Delete"
            onPress={(): void => {
              remove()
            }}
            role="destructive"
          />
        </Alert.Actions>
      </Alert>
    </VStack>
  )
}
