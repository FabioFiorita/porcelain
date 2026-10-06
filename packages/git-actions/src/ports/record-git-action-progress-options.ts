import { Context } from 'effect';
import type { RecordGitActionProgressOptions as RecordGitActionProgressOptionsShape } from '../models/record-git-action-progress.ts';
export const RecordGitActionProgressOptions = Context.Service<
  '@porcelain/git-actions/RecordGitActionProgressOptions',
  RecordGitActionProgressOptionsShape
>('@porcelain/git-actions/RecordGitActionProgressOptions');
