import { Context } from 'effect';
import type { SetReviewedFilesOptions as SetReviewedFilesOptionsShape } from '../models/set-reviewed-files.ts';
export const SetReviewedFilesOptions = Context.Service<
  '@porcelain/reviews/SetReviewedFilesOptions',
  SetReviewedFilesOptionsShape
>('@porcelain/reviews/SetReviewedFilesOptions');
