import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { Sheet } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/**
 * The one place a comment is written on a phone.
 *
 * It always opens onto an existing anchor, because that is the only anchor mobile's Review
 * surface has: a comment needs a repo-relative `path`, and picking one out of nowhere would be
 * inventing the thing the human is commenting on. Replying to a thread and adding a second
 * comment to it are therefore the same act, and this sheet is both.
 */
export function CommentComposerSheet({
  anchorLabel,
  initialBody = '',
  mode = 'reply',
  onClose,
  onSubmit,
  open,
  pending,
  subject,
  testIDPrefix = 'porcelain-comment-composer',
}: {
  /** "Line 12" / "File comment" — what the new comment will be attached to. */
  anchorLabel: string
  initialBody?: string
  mode?: 'edit' | 'reply'
  onClose: () => void
  onSubmit: (body: string) => void
  open: boolean
  pending: boolean
  /** The file the anchor belongs to. */
  subject: string
  /** Distinguishes this sheet's testIDs when more than one surface can open one. */
  testIDPrefix?: string
}): React.JSX.Element {
  const [body, setBody] = useState(initialBody)

  // A closed sheet keeps no reply draft. An edit reopens with the daemon's current body, so it
  // cannot accidentally preserve text from a different comment.
  useEffect(() => {
    setBody(open ? initialBody : '')
  }, [initialBody, open])

  const canSend = body.trim() !== '' && !pending

  return (
    <Sheet
      open={open}
      testID={testIDPrefix}
      title={mode === 'edit' ? 'Edit comment' : 'Reply'}
      onClose={onClose}
    >
      <View className="gap-3 px-5 pb-2">
        <View className="gap-0.5">
          <Text className="text-xs font-medium text-foreground">{anchorLabel}</Text>
          <Text className="font-mono text-3xs text-muted-foreground" numberOfLines={1}>
            {subject}
          </Text>
        </View>
        <Textarea
          accessibilityLabel="Comment body"
          autoCapitalize="sentences"
          editable={!pending}
          numberOfLines={5}
          placeholder="What should the agent change?"
          testID={`${testIDPrefix}-input`}
          value={body}
          onChangeText={setBody}
        />
        <View className="flex-row justify-end gap-2">
          <Pressable
            accessibilityLabel="Cancel comment"
            accessibilityRole="button"
            className="h-9 min-w-18 items-center justify-center rounded-lg border border-border bg-secondary px-3 active:opacity-80"
            testID={`${testIDPrefix}-cancel`}
            onPress={onClose}
          >
            <Text className="text-sm font-medium text-secondary-foreground">Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={mode === 'edit' ? 'Save comment' : 'Send comment'}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            className={cn(
              'h-9 min-w-18 items-center justify-center rounded-lg border border-primary bg-primary px-3 active:opacity-80',
              !canSend && 'opacity-50',
            )}
            disabled={!canSend}
            testID={`${testIDPrefix}-send`}
            onPress={() => {
              onSubmit(body.trim())
            }}
          >
            <Text className="text-sm font-medium text-primary-foreground">
              {mode === 'edit' ? 'Save' : 'Send'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  )
}
