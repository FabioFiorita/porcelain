import { Context } from 'effect';
import type { CollectAbsentWorktreesOptions as CollectAbsentWorktreesOptionsShape } from '../models/collect-absent-worktrees.ts';
export const CollectAbsentWorktreesOptions = Context.Service<
  '@porcelain/projects/CollectAbsentWorktreesOptions',
  CollectAbsentWorktreesOptionsShape
>('@porcelain/projects/CollectAbsentWorktreesOptions');
