import { Context } from 'effect';
import type { CheckWorktreeOptions as CheckWorktreeOptionsShape } from '../models/check-worktree.ts';
export const CheckWorktreeOptions = Context.Service<
  '@porcelain/projects/CheckWorktreeOptions',
  CheckWorktreeOptionsShape
>('@porcelain/projects/CheckWorktreeOptions');
