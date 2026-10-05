import { Context } from 'effect';
import type { CaptureCommitDraftOptions as CaptureCommitDraftOptionsShape } from '../models/capture-commit-draft.ts';
export const CaptureCommitDraftOptions = Context.Service<
  '@porcelain/git-actions/CaptureCommitDraftOptions',
  CaptureCommitDraftOptionsShape
>('@porcelain/git-actions/CaptureCommitDraftOptions');
