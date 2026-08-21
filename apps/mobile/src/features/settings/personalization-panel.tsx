import { EmptyNote } from '@/components/panel-chrome'

/**
 * Settings › Personalization — the worktree profile (pinned and hidden paths, story layer
 * order). The desktop client shows it READ-ONLY; mobile has no reader for it yet, so this says
 * so rather than showing an empty card that reads as a broken query.
 */
export function PersonalizationSettings(): React.JSX.Element {
  return (
    <EmptyNote
      body="The worktree profile — pinned paths, hidden paths, and story layer order — is set by your agent and shown read-only in the desktop client. Mobile has no reader for it yet."
      testID="porcelain-settings-personalization-empty"
      title="Not on mobile yet"
    />
  )
}
