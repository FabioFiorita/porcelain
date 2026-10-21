export const archiveSettings = [
  { key: 'archiveDeleteWorktree', label: 'Delete local worktree' },
  { key: 'archiveDeleteLocalBranch', label: 'Delete local branch' },
  { key: 'archiveDeleteRemoteBranch', label: 'Delete remote branch' },
] as const;
export function archiveOptions(preferences: {
  archiveDeleteWorktree: boolean;
  archiveDeleteLocalBranch: boolean;
  archiveDeleteRemoteBranch: boolean;
}) {
  return {
    deleteWorktree: preferences.archiveDeleteWorktree,
    deleteLocalBranch: preferences.archiveDeleteLocalBranch,
    deleteRemoteBranch: preferences.archiveDeleteRemoteBranch,
  };
}
