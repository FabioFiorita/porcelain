import { useIsFocused } from 'expo-router'
import { Stack } from 'expo-router/stack'
import { View } from 'react-native'

import { EmptyNote } from '@/components/panel-chrome'
import { SurfaceScroll } from '@/components/surface-scroll'
import { useHubRepoPath } from '@/features/projects'
import { HeaderActions } from '@/features/shell/header-actions'

import { GitBranchCard } from './git-branch-card'
import { GitCommandsCard } from './git-commands-card'
import { GitCommitCard } from './git-commit-card'

/**
 * The Git surface: branch, commands, suggestions, and commit.
 *
 * Same content as the web rail's Git surface ("Commands, suggestions, and commit"), in the same
 * order, reached through the Worktree that owns the checkout. Branch context leads because a
 * phone has no status bar to keep it on: what you are about to commit to has to be visible on
 * the screen where you commit.
 *
 * There is no companion bolt. Web's Git surface IS the companion column's content — a second
 * one here would open a sheet holding what is already on screen.
 */
export function GitScreen(): React.JSX.Element {
  const repoPath = useHubRepoPath()
  // The reads poll while this screen is the one you are looking at, and stop when it is not.
  const active = useIsFocused()

  return (
    <View className="flex-1 bg-background" testID="porcelain-git-screen">
      {/* Set here rather than in the stack layout: the layout does not know a surface exists
          until a Worktree pushes it. */}
      <Stack.Screen options={{ headerRight: () => <HeaderActions />, title: 'Git' }} />
      {repoPath === null ? (
        <EmptyNote
          body="Pick a worktree from the list first."
          testID="porcelain-git-empty"
          title="No worktree selected"
        />
      ) : (
        <SurfaceScroll
          gap={20}
          keyboardShouldPersistTaps="handled"
          paddingTop={12}
          testID="porcelain-git-surface"
        >
          <GitBranchCard active={active} />
          <GitCommandsCard active={active} />
          <GitCommitCard active={active} />
        </SurfaceScroll>
      )}
    </View>
  )
}
