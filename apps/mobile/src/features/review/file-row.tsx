import { Button, HStack, Image, Menu, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import {
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  shapes,
} from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'

import type { ReadingFile, ReviewComment } from '@/lib/daemon/procedures/review'
import { openDiff, openFile } from '@/lib/surface-handoffs'
import { footnote, secondary } from '@/theme/modifiers'

const sourceColors = {
  changed: '#FF9500',
  context: '#8E8E93',
  shipped: '#00A6F4',
} as const

export function FileRow({
  comments,
  file,
  onToggleReviewed,
  reviewed,
}: {
  comments: readonly ReviewComment[]
  file: ReadingFile
  onToggleReviewed: () => void
  reviewed: boolean
}): React.JSX.Element {
  const name = file.path.split('/').at(-1) ?? file.path
  const directory = file.path.split('/').slice(0, -1).join('/')
  const open = (): void => {
    if (file.source === 'changed') openDiff(file.path)
    else openFile(file.path)
  }

  return (
    <VStack alignment="leading" spacing={6}>
      <HStack spacing={8}>
        <Button
          modifiers={[
            buttonStyle('plain'),
            contentShape(shapes.rectangle()),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
          onPress={open}
        >
          <HStack modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]} spacing={8}>
            <Image color={sourceColors[file.source]} size={12} systemName="circle.fill" />
            <VStack alignment="leading" spacing={2}>
              <Text modifiers={[font({ weight: reviewed ? 'regular' : 'semibold' }), lineLimit(1)]}>
                {name}
              </Text>
              {directory === '' ? null : (
                <Text modifiers={[footnote, secondary, lineLimit(1)]}>{directory}</Text>
              )}
            </VStack>
            <Spacer />
            {file.additions === undefined || file.additions === 0 ? null : (
              <Text
                modifiers={[footnote, foregroundStyle({ color: '#34C759', type: 'color' })]}
              >{`+${file.additions}`}</Text>
            )}
            {file.deletions === undefined || file.deletions === 0 ? null : (
              <Text
                modifiers={[footnote, foregroundStyle({ color: '#FF3B30', type: 'color' })]}
              >{`−${file.deletions}`}</Text>
            )}
          </HStack>
        </Button>
        {comments.length === 0 ? null : (
          <Text modifiers={[footnote, foregroundStyle({ color: '#00A6F4', type: 'color' })]}>
            {String(comments.length)}
          </Text>
        )}
        <Button
          modifiers={[buttonStyle('plain')]}
          onPress={onToggleReviewed}
          systemImage={reviewed ? 'checkmark.circle.fill' : 'circle'}
        />
        <Menu label={<Image modifiers={[secondary]} size={16} systemName="ellipsis.circle" />}>
          <Button
            label="Comment on this file"
            onPress={(): void => router.push({ params: { path: file.path }, pathname: '/comment' })}
            systemImage="text.bubble"
          />
          <Button
            label={file.source === 'changed' ? 'Open diff' : 'Open file'}
            onPress={open}
            systemImage="arrow.up.right"
          />
          <Button
            label={reviewed ? 'Unmark reviewed' : 'Mark reviewed'}
            onPress={onToggleReviewed}
            systemImage={reviewed ? 'circle' : 'checkmark.circle'}
          />
        </Menu>
      </HStack>
      {comments.length === 0 ? null : <CommentBodies comments={comments} />}
    </VStack>
  )
}

function CommentBodies({ comments }: { comments: readonly ReviewComment[] }): React.JSX.Element {
  return (
    <VStack alignment="leading" spacing={6}>
      {comments.map((comment) => (
        <VStack alignment="leading" key={comment.id} spacing={4}>
          <HStack alignment="top" spacing={6}>
            <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>{comment.body}</Text>
            {comment.resolved ? (
              <Text modifiers={[font({ textStyle: 'caption2' }), secondary]}>Resolved</Text>
            ) : null}
          </HStack>
          {comment.agentReply === undefined ? null : (
            <Text
              modifiers={[
                font({ textStyle: 'footnote' }),
                foregroundStyle({ color: '#34C759', type: 'color' }),
              ]}
            >
              {`Agent: ${comment.agentReply.body}`}
            </Text>
          )}
        </VStack>
      ))}
    </VStack>
  )
}
