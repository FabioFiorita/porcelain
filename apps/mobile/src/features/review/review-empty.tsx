import { Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
// The Board hands a card's title over when it sends you here to start the unit. Consumed
// once, so the name stays stable while you read it.

/**
 * The start of a unit of work.
 *
 * There is no baseline Review — one exists only once an agent publishes it — so the empty
 * canvas is not an error state, it is the front door. It says what a unit is and what the
 * agent has to publish first; the lifecycle itself is driven agent-side.
 */
export function ReviewEmptyState(): React.JSX.Element {
  const suggestedName = null

  return (
    <View className="flex-1 items-center justify-center p-6" testID="porcelain-review-empty">
      <View className="w-full max-w-sm gap-3">
        <View className="flex-row items-center gap-2">
          <ChromeGlyph name="sparkles" size={16} tone="primary" />
          <Text className="text-sm font-semibold text-foreground">Start this unit of work</Text>
        </View>
        <Text className="text-xs leading-5 text-muted-foreground">
          The Review is where a unit begins and ends — bug, feature, chore, or investigation. Ask
          your agent to publish Intent first (name + thesis); Process and Execution grow as the work
          finishes, with Evidence closing the loop. Archive the previous unit before starting a new
          one.
        </Text>
        {suggestedName === null ? null : (
          <View
            className="rounded-xl border border-border bg-muted/50 px-2.5 py-2"
            testID="porcelain-review-empty-suggested"
          >
            <Text className="text-xs text-foreground">
              Suggested name: <Text className="font-medium">{suggestedName}</Text>
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}
