import { useRouter } from 'expo-router'
import { Pressable } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'

/** The `+` in the Worktrees list's native bar — it presents the New Worktree sheet. */
export function NewWorktreeHeaderAction(): React.JSX.Element {
  const router = useRouter()

  return (
    <Pressable
      accessibilityLabel="New Worktree"
      accessibilityRole="button"
      className="min-h-11 min-w-9 items-center justify-center active:opacity-50"
      hitSlop={8}
      testID="porcelain-hub-new-worktree"
      onPress={() => {
        router.push('/new-worktree')
      }}
    >
      <ChromeGlyph name="plus" size={19} tone="foreground" />
    </Pressable>
  )
}
