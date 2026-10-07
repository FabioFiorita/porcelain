import { Context } from 'effect';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import type { ListedWorktree } from '../models/listed-worktree.ts';

export type ListedWorktreeAccessReader = WorktreeAccessReader<ListedWorktree>;

export const ListedWorktreeAccessReader = Context.Service<
  '@porcelain/projects/ListedWorktreeAccessReader',
  ListedWorktreeAccessReader
>('@porcelain/projects/ListedWorktreeAccessReader');
