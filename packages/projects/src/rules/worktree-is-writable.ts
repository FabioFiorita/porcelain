import type { ListedWorktree } from '../models/listed-worktree.ts';
import type { RegisteredProject } from '../models/project.ts';

export function worktreeIsWritable(
  worktree: Pick<ListedWorktree, 'available'>,
  project: Pick<RegisteredProject, 'available'> | undefined,
): boolean {
  return project?.available === true && worktree.available;
}
