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
  onClose,
  onSubmit,
  open,
  pending,
  subject,
}: {
  /** "Line 12" / "File comment" — what the new comment will be attached to. */
  anchorLabel: string
  onClose: () => void
  onSubmit: (body: string) => void
  open: boolean
  pending: boolean
  /** The file the anchor belongs to. */
  subject: string
}): React.JSX.Element {
  const [body, setBody] = useState('')

  // A closed sheet keeps no draft: it reopens on whichever thread was tapped next, and a body
  // written for another anchor is worse than an empty field.
  useEffect(() => {
    if (!open) setBody('')
  }, [open])

  const canSend = body.trim() !== '' && !pending

  return (
    <Sheet open={open} testID="porcelain-comment-composer" title="Reply" onClose={onClose}>
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
          testID="porcelain-comment-composer-input"
          value={body}
          onChangeText={setBody}
        />
        <View className="flex-row justify-end gap-2">
          <Pressable
            accessibilityLabel="Cancel comment"
            accessibilityRole="button"
            className="h-9 min-w-18 items-center justify-center rounded-lg border border-border bg-secondary px-3 active:opacity-80"
            testID="porcelain-comment-composer-cancel"
            onPress={onClose}
          >
            <Text className="text-sm font-medium text-secondary-foreground">Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Send comment"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            className={cn(
              'h-9 min-w-18 items-center justify-center rounded-lg border border-primary bg-primary px-3 active:opacity-80',
              !canSend && 'opacity-50',
            )}
            disabled={!canSend}
            testID="porcelain-comment-composer-send"
            onPress={() => {
              onSubmit(body.trim())
            }}
          >
            <Text className="text-sm font-medium text-primary-foreground">Send</Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  )
}
