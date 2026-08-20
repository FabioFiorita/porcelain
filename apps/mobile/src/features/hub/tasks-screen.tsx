import { View } from 'react-native'

import { EmptyNote } from '@/components/panel-chrome'
import { PhoneHeader } from '@/features/shell/phone-header'

/**
 * Tasks — the daemon-wide task board. Stubbed: `packages/client-runtime/src/tasks` already owns
 * the shared semantics the web client reads, so the mobile panel is a later session's work, not
 * a new contract.
 */
export function TasksScreen(): React.JSX.Element {
  return (
    <View className="flex-1 bg-background" testID="porcelain-tasks-screen">
      <PhoneHeader back={false} companion={false} search={false} title="Tasks" />
      <EmptyNote
        body="The daemon-wide task board. Not built on mobile yet — it reads the same tasks the web client shows."
        testID="porcelain-tasks-empty"
        title="Tasks is not built yet"
      />
    </View>
  )
}
