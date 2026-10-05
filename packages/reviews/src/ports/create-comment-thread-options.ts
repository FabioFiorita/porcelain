import { Context } from 'effect';
import type { CreateCommentThreadOptions as CreateCommentThreadOptionsShape } from '../models/create-comment-thread.ts';
export const CreateCommentThreadOptions = Context.Service<
  '@porcelain/reviews/CreateCommentThreadOptions',
  CreateCommentThreadOptionsShape
>('@porcelain/reviews/CreateCommentThreadOptions');
