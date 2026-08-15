import type { ReviewReading } from '@porcelain/contracts/review'
import { View } from 'react-native'
import { EmptyNote } from '@/components/panel-chrome'
import { PreviewView, readerDocument } from '@/features/files'
import { useResolvedColorScheme } from '@/features/settings/theme-provider'

import { processMarkup } from './review-markup'

/** Process: the walkthrough prose, diagrams, and embeds that explain how the unit fits together. */
export function ProcessBody({ reading }: { reading: ReviewReading }): React.JSX.Element {
  const scheme = useResolvedColorScheme()
  const markup = processMarkup(reading)

  if (markup === null) {
    return (
      <EmptyNote
        body="No Process yet — the agent publishes walkthrough sections with review set --sections."
        testID="porcelain-review-process-empty"
        title="Nothing to follow yet"
      />
    )
  }

  return (
    <View className="flex-1" testID="porcelain-review-process">
      <PreviewView
        document={readerDocument(markup, scheme)}
        testID="porcelain-review-process-document"
      />
    </View>
  )
}
