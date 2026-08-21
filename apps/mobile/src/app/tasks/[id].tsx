import { useLocalSearchParams } from 'expo-router'

import { ClearBottomChrome } from '@/features/shell/bottom-chrome'
import { TaskDetailSheet } from '@/features/tasks'

/**
 * One Task. The Environment is a URL parameter rather than a store read: every Tasks write has
 * to name the daemon it goes to, and a screen that inferred it from "the active Environment"
 * would edit the wrong machine's Task the moment the board showed two.
 */
export default function TaskDetailRoute(): React.JSX.Element {
  const { environment, id } = useLocalSearchParams<{ environment?: string; id: string }>()
  return (
    <ClearBottomChrome>
      <TaskDetailSheet environmentId={environment ?? ''} taskId={id} />
    </ClearBottomChrome>
  )
}
