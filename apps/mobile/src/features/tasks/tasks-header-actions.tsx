import { useRouter } from 'expo-router'
import { Pressable } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'

/**
 * The Tasks stack's `headerRight`: compose a new Task.
 *
 * A bare glyph on a touch target, like the Hub's header items — `UINavigationBar` and the
 * Material app bar draw the affordance, so a border here would be a button inside a button.
 * It is its own component rather than a case in `features/shell/header-actions` because that
 * cluster is the Hub's (quick open + surface companion) and Tasks shares neither.
 */
export function NewTaskHeaderAction(): React.JSX.Element {
  const router = useRouter()

  return (
    <Pressable
      accessibilityLabel="New Task"
      accessibilityRole="button"
      className="min-h-11 min-w-9 items-center justify-center active:opacity-50"
      hitSlop={8}
      testID="porcelain-tasks-new"
      onPress={() => {
        router.push('/tasks/new')
      }}
    >
      <ChromeGlyph name="plus" size={19} tone="foreground" />
    </Pressable>
  )
}
