import { Context } from 'effect';
import type { GenerateCommitDraftOptions as GenerateCommitDraftOptionsShape } from '../models/generate-commit-draft.ts';
export const GenerateCommitDraftOptions = Context.Service<
  '@porcelain/git-actions/GenerateCommitDraftOptions',
  GenerateCommitDraftOptionsShape
>('@porcelain/git-actions/GenerateCommitDraftOptions');
