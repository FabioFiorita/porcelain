import { useState } from 'react'
import { Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { StatusNote } from '@/components/panel-chrome'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
// The Board hands a card's title over when it sends you here to start the unit. Consumed
// once, so the prompt stays stable while you read it.
import { useReviewHandoffStore } from '@/features/board/review-handoff-store'
import { copyText } from '@/lib/clipboard'

import { reviewStartPrompt } from './review-lifecycle'

/**
 * The start of a unit of work.
 *
 * There is no baseline Review — one exists only once an agent publishes it — so the empty
 * canvas is not an error state, it is the front door. What it offers is the thing the human
 * can actually do from a phone: put the begin-unit prompt on the pasteboard, ready to paste
 * wherever the agent is listening.
 */
export function ReviewEmptyState(): React.JSX.Element {
  const [suggestedName] = useState(() => useReviewHandoffStore.getState().consume())
  const [status, setStatus] = useState<{ failed: boolean; text: string } | null>(null)

  const handleCopy = (): void => {
    copyText(reviewStartPrompt(suggestedName === null ? undefined : { name: suggestedName }))
      .then((copied) => {
        setStatus({
          failed: !copied,
          text: copied ? 'Begin-unit prompt copied.' : 'Could not reach the pasteboard.',
        })
      })
      .catch(() => {
        setStatus({ failed: true, text: 'Could not reach the pasteboard.' })
      })
  }

  return (
    <View className="flex-1 items-center justify-center p-6" testID="porcelain-review-empty">
      <View className="w-full max-w-sm gap-3">
        <View className="flex-row items-center gap-2">
          <ChromeGlyph name="sparkles" size={16} tone="primary" />
          <Text className="text-sm font-semibold text-foreground">Start this unit of work</Text>
        </View>
        <Text className="text-xs leading-5 text-muted-foreground">
          The Review is where a unit begins and ends — bug, feature, chore, or investigation. Ask
          your agent to publish Intent first (name + thesis); Execution and Evidence grow as the
          work finishes. Archive the previous unit before starting a new one.
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
        <Button
          accessibilityLabel="Copy the begin-unit prompt"
          accessibilityRole="button"
          testID="porcelain-review-copy-start-prompt"
          variant="outline"
          onPress={handleCopy}
        >
          <ChromeGlyph name="copy" size={14} />
          <UiText>Copy begin-unit prompt</UiText>
        </Button>
        {status === null ? null : (
          <StatusNote
            failed={status.failed}
            testID="porcelain-review-copy-status"
            text={status.text}
          />
        )}
      </View>
    </View>
  )
}
