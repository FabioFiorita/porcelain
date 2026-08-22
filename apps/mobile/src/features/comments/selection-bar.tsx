import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'

import { describeRange, type LineRange } from './line-range'

/**
 * The bar that appears once a line selection exists: what it covers, and the two things a
 * selection can become — a comment, or nothing. Sits at the bottom of the surface that owns the
 * selection, above `CommentComposer`'s sheet.
 */
export function SelectionBar({
  bottomInset,
  path,
  range,
  testIDPrefix,
  onCancel,
  onComment,
}: {
  bottomInset: number
  /** Repo-relative — shown as context under the range. */
  path: string
  range: LineRange
  testIDPrefix: string
  onCancel: () => void
  onComment: () => void
}): React.JSX.Element {
  return (
    <View
      className="flex-row items-center gap-3 border-t border-border bg-card px-4 py-2"
      style={{ paddingBottom: (bottomInset === 0 ? 8 : bottomInset) + 8 }}
      testID={`${testIDPrefix}-bar`}
    >
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-foreground">{describeRange(range)}</Text>
        <Text className="font-mono text-3xs text-muted-foreground" numberOfLines={1}>
          {path}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Cancel selection"
        accessibilityRole="button"
        className="min-h-9 min-w-9 items-center justify-center rounded-lg active:bg-accent"
        hitSlop={4}
        testID={`${testIDPrefix}-cancel`}
        onPress={onCancel}
      >
        <ChromeGlyph name="close" size={16} tone="muted" />
      </Pressable>
      <Pressable
        accessibilityLabel="Comment on selection"
        accessibilityRole="button"
        className="h-9 flex-row items-center gap-1.5 rounded-lg bg-primary px-3 active:opacity-80"
        testID={`${testIDPrefix}-comment`}
        onPress={onComment}
      >
        <ChromeGlyph name="commentAdd" size={14} tone="primaryForeground" />
        <Text className="text-sm font-medium text-primary-foreground">Comment</Text>
      </Pressable>
    </View>
  )
}
