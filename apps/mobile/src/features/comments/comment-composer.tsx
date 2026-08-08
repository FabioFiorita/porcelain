import { fileName } from '@porcelain/client-runtime/paths'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { ShellModal, useShellModalSize } from '@/components/shell-modal'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import type { ReviewComment } from '@/lib/daemon/procedures/review'

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
 *
 * Pass `editing` to rewrite an existing comment instead: one form for both, so a typo is fixed
 * where it was written rather than deleted and retyped. An edited comment keeps its anchor, its
 * resolved flag and the agent's reply — only the body moves.
 */
export function CommentComposer({
  anchor,
  editing = null,
  onClose,
  testIDPrefix = 'porcelain-changes-comment',
}: {
  /** The lines a NEW comment is filed against. Ignored while `editing` — a comment is already anchored. */
  anchor: CommentAnchor | null
  editing?: ReviewComment | null
  onClose: () => void
  /** Keeps the established Changes IDs while giving other surfaces their own targets. */
  testIDPrefix?: string
}): React.JSX.Element {
  const { add, edit } = useCommentActions()
  const { width } = useShellModalSize()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A comment carries its own anchor, so editing one needs no second source for the header.
  const target: CommentAnchor | null = editing ?? anchor
  const open = target !== null
  const initialBody = editing?.body ?? ''

  // Fresh field per anchor — a draft left from the last line would be filed against this one.
  // An edit opens on the body it is rewriting, or "save" would silently erase it.
  useEffect(() => {
    if (open) {
      setBody(initialBody)
      setError(null)
    }
  }, [open, initialBody])

  const handleSave = async (): Promise<void> => {
    const next = body.trim()
    if (next === '' || saving) return
    setSaving(true)
    setError(null)
    try {
      if (editing !== null) {
        await edit(editing.id, next)
      } else if (anchor !== null) {
        await add({
          body: next,
          path: anchor.path,
          ...(anchor.startLine === undefined ? {} : { startLine: anchor.startLine }),
          ...(anchor.endLine === undefined ? {} : { endLine: anchor.endLine }),
          ...(anchor.anchorText === undefined ? {} : { anchorText: anchor.anchorText }),
        })
      }
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
      title={editing === null ? 'Add comment' : 'Edit comment'}
      contentStyle={{ width }}
      description={target === null ? undefined : describeAnchor(target)}
    >
      <View className="gap-3" testID={`${testIDPrefix}-composer`}>
        {target?.anchorText === undefined ? null : (
          <View className="max-h-28 overflow-hidden rounded-md bg-muted px-2.5 py-2">
            <Text className="font-mono text-2xs leading-4 text-muted-foreground">
              {target.anchorText}
            </Text>
          </View>
        )}
        <Textarea
          accessibilityLabel="Comment"
          autoFocus={open}
          className="min-h-24"
          placeholder="What should the agent know about this?"
          testID={`${testIDPrefix}-input`}
          value={body}
          onChangeText={setBody}
        />
        {error === null ? null : (
          <Text className="text-xs text-destructive" testID={`${testIDPrefix}-error`}>
            {error}
          </Text>
        )}
        <View className="flex-row justify-end gap-2">
          <Button testID={`${testIDPrefix}-cancel`} variant="ghost" onPress={onClose}>
            <UiText>Cancel</UiText>
          </Button>
          <Button
            disabled={body.trim() === '' || saving}
            testID={`${testIDPrefix}-save`}
            onPress={() => {
              handleSave()
            }}
          >
            <UiText>{saving ? 'Saving…' : editing === null ? 'Comment' : 'Save'}</UiText>
          </Button>
        </View>
      </View>
    </ShellModal>
  )
}
