import { View } from 'react-native'

import { EmptyNote } from '@/components/panel-chrome'

/**
 * Console — one terminal for the agent runner (herdr / tmux) ACROSS worktrees, as opposed to
 * the per-Worktree Terminal surface reached from a Worktree. Stubbed: the engine that would
 * back it (`features/terminal`) is per-checkout today, and wiring a cross-worktree session is
 * its own piece of work.
 */
export function ConsoleScreen(): React.JSX.Element {
  return (
    <View className="flex-1 bg-background" testID="porcelain-console-screen">
      <EmptyNote
        body="One terminal for the agent runner across every worktree. Not built yet — a worktree's own sessions live under its Terminal surface."
        testID="porcelain-console-empty"
        title="Console is not built yet"
      />
    </View>
  )
}
