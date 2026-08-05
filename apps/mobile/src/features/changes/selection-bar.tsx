import { fileName } from '@porcelain/client-runtime/paths'
import { Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'

import { describeRange, type LineRange } from './line-selection'

/**
 * The floating confirm for an open line selection.
 *
 * A selection you cannot see the extent of is a selection you cannot trust, so the bar names
 * the exact range it will file the comment against, and stays until it is used or dismissed.
 */
export function SelectionBar({
  bottomInset,
  onCancel,
  onComment,
  path,
  range,
}: {
  bottomInset: number
  onCancel: () => void
  onComment: () => void
  /** Named so the multi-file read makes clear which file the range belongs to. */
  path: string
  range: LineRange
}): React.JSX.Element {
  return (
    <View
      className="absolute inset-x-3 flex-row items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-lg"
      style={{ bottom: bottomInset + 12 }}
      testID="porcelain-changes-selection-bar"
    >
      <View className="min-w-0 flex-1">
        <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
          {describeRange(range)}
        </Text>
        <Text className="font-mono text-[10px] text-muted-foreground" numberOfLines={1}>
          {fileName(path)} · tap another line to extend
        </Text>
      </View>
      <Button
        accessibilityLabel="Cancel selection"
        size="sm"
        testID="porcelain-changes-selection-cancel"
        variant="ghost"
        onPress={onCancel}
      >
        <UiText>Cancel</UiText>
      </Button>
      <Button
        accessibilityLabel={`Comment on ${describeRange(range).toLowerCase()}`}
        size="sm"
        testID="porcelain-changes-selection-comment"
        onPress={onComment}
      >
        <ChromeGlyph name="commentAdd" size={14} tone="primaryForeground" />
        <UiText>Comment</UiText>
      </Button>
    </View>
  )
}
