import type { ListedWorktree } from '../models/listed-worktree.ts';

export function sameWorktree(
  checked: ListedWorktree,
  current: ListedWorktree | undefined,
): boolean {
  return (
    current !== undefined &&
    current.id === checked.id &&
    current.projectId === checked.projectId &&
    current.path === checked.path &&
    current.metadataIdentity === checked.metadataIdentity &&
    current.administrativeDirectory === checked.administrativeDirectory &&
    current.repositoryIdentity === checked.repositoryIdentity
  );
}
