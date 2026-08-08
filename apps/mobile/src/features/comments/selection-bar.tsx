import { fileName } from '@porcelain/client-runtime/paths'
import { Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { PANEL_CARD } from '@/components/surface-layout'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'

import { describeRange, type LineRange } from './line-range'

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
  testIDPrefix = 'porcelain-changes-selection',
}: {
  bottomInset: number
  onCancel: () => void
  onComment: () => void
  /** Named so the multi-file read makes clear which file the range belongs to. */
  path: string
  range: LineRange
  /** Keeps the established Changes IDs while giving other surfaces their own targets. */
  testIDPrefix?: string
}): React.JSX.Element {
  return (
    <View
      className={cn(
        'absolute inset-x-3 flex-row items-center gap-2 px-3 py-2 shadow-lg',
        PANEL_CARD,
      )}
      style={{ bottom: bottomInset + 12 }}
      testID={`${testIDPrefix}-bar`}
    >
      <View className="min-w-0 flex-1">
        <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
          {describeRange(range)}
        </Text>
        <Text className="font-mono text-3xs text-muted-foreground" numberOfLines={1}>
          {fileName(path)} · tap another line to extend
        </Text>
      </View>
      <Button
        accessibilityLabel="Cancel selection"
        size="sm"
        testID={`${testIDPrefix}-cancel`}
        variant="ghost"
        onPress={onCancel}
      >
        <UiText>Cancel</UiText>
      </Button>
      <Button
        accessibilityLabel={`Comment on ${describeRange(range).toLowerCase()}`}
        size="sm"
        testID={`${testIDPrefix}-comment`}
        onPress={onComment}
      >
        <ChromeGlyph name="commentAdd" size={14} tone="primaryForeground" />
        <UiText>Comment</UiText>
      </Button>
    </View>
  )
}
