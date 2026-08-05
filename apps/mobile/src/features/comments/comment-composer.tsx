import { fileName } from '@porcelain/client-runtime/paths'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { ShellModal, useShellModalSize } from '@/components/shell-modal'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'

import { useCommentActions } from './use-comments'

export type CommentAnchor = {
  /** Repo-relative path. */
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
}

/** "Line 12 of diff-view.tsx", "Lines 12–18 of diff-view.tsx", or just the file name. */
export function describeAnchor(anchor: CommentAnchor): string {
  const name = fileName(anchor.path)
  if (anchor.startLine === undefined) return name
  if (anchor.endLine !== undefined && anchor.endLine !== anchor.startLine) {
    return `Lines ${anchor.startLine}–${anchor.endLine} of ${name}`
  }
  return `Line ${anchor.startLine} of ${name}`
}

/**
 * Write a review comment anchored to a line range, or to the file as a whole. Saves to the
 * same comment channel the agent reads through the porcelain CLI — this is the half of the
 * loop where a phone read turns into work the agent picks up.
 */
export function CommentComposer({
  anchor,
  onClose,
}: {
  anchor: CommentAnchor | null
  onClose: () => void
}): React.JSX.Element {
  const { add } = useCommentActions()
  const { width } = useShellModalSize()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = anchor !== null

  // Fresh field per anchor — a draft left from the last line would be filed against this one.
  useEffect(() => {
    if (open) {
      setBody('')
      setError(null)
    }
  }, [open])

  const handleSave = async (): Promise<void> => {
    if (anchor === null || body.trim() === '' || saving) return
    setSaving(true)
    setError(null)
    try {
      await add({
        body: body.trim(),
        path: anchor.path,
        ...(anchor.startLine === undefined ? {} : { startLine: anchor.startLine }),
        ...(anchor.endLine === undefined ? {} : { endLine: anchor.endLine }),
        ...(anchor.anchorText === undefined ? {} : { anchorText: anchor.anchorText }),
      })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the comment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ShellModal
      open={open}
      onClose={onClose}
      title="Add comment"
      contentStyle={{ width }}
      description={anchor === null ? undefined : describeAnchor(anchor)}
    >
      <View className="gap-3" testID="porcelain-comment-composer">
        {anchor?.anchorText === undefined ? null : (
          <View className="max-h-28 overflow-hidden rounded-md bg-muted px-2.5 py-2">
            <Text className="font-mono text-[11px] leading-4 text-muted-foreground">
              {anchor.anchorText}
            </Text>
          </View>
        )}
        <Textarea
          accessibilityLabel="Comment"
          autoFocus={open}
          className="min-h-24"
          placeholder="What should the agent know about this?"
          testID="porcelain-comment-input"
          value={body}
          onChangeText={setBody}
        />
        {error === null ? null : (
          <Text className="text-xs text-destructive" testID="porcelain-comment-error">
            {error}
          </Text>
        )}
        <View className="flex-row justify-end gap-2">
          <Button testID="porcelain-comment-cancel" variant="ghost" onPress={onClose}>
            <UiText>Cancel</UiText>
          </Button>
          <Button
            disabled={body.trim() === '' || saving}
            testID="porcelain-comment-save"
            onPress={() => {
              handleSave()
            }}
          >
            <UiText>{saving ? 'Saving…' : 'Comment'}</UiText>
          </Button>
        </View>
      </View>
    </ShellModal>
  )
}
