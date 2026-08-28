import { View } from 'react-native'

import { EmptyNote } from '@/components/panel-chrome'
import { SurfaceScroll } from '@/components/surface-scroll'
import { useHubRepoPath } from '@/features/projects'

import { GitCommandsCard } from './git-commands-card'
import { GitCommitCard } from './git-commit-card'

/**
 * The Git surface body — commands, suggestions, and commit.
 *
 * Same content as the web rail's Git surface ("Commands, suggestions, and commit"), in the same
 * order, and shared by both hosts: the phone's screen under its own header, and the tablet's
 * Surfaces panel beside the viewer. Branch context belongs to the Changes header, where its
 * comparison control already identifies the checkout without repeating a second branch card.
 *
 * Git has no companion on either client: web's Git surface IS what a companion column would
 * hold, so a bolt here would open a sheet showing what is already on screen.
 */
export function GitSurfacePanel({ active }: { active: boolean }): React.JSX.Element {
  const repoPath = useHubRepoPath()

  if (repoPath === null) {
    return (
      <View className="flex-1" testID="porcelain-git-surface-panel">
        <EmptyNote
          body="Pick a worktree from the list first."
          testID="porcelain-git-empty"
          title="No worktree selected"
        />
      </View>
    )
  }

  return (
    <SurfaceScroll
      gap={20}
      keyboardShouldPersistTaps="handled"
      paddingTop={12}
      testID="porcelain-git-surface"
    >
      <GitCommandsCard active={active} />
      <GitCommitCard active={active} />
    </SurfaceScroll>
  )
}
