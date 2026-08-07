import { ScrollView } from 'react-native'

import { CommentsCard } from './comments-card'
import { CommitCard } from './commit-card'
import { QuickCommandsCard } from './quick-commands-card'

/**
 * The Changes companion, in the web's order: Suggested · Commands · Commit · Comments.
 *
 * One component for both hosts — the tablet inspector column and the phone's bolt sheet —
 * so the two can never drift into different companions for the same surface.
 */
export function ChangesCompanion({ active }: { active: boolean }): React.JSX.Element {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-5 px-4 pb-8 pt-3"
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      testID="porcelain-changes-companion"
    >
      <QuickCommandsCard active={active} />
      <CommitCard active={active} />
      <CommentsCard active={active} />
    </ScrollView>
  )
}
