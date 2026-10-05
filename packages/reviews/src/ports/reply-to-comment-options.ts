import { Context } from 'effect';
import type { ReplyToCommentOptions as ReplyToCommentOptionsShape } from '../models/reply-to-comment.ts';
export const ReplyToCommentOptions = Context.Service<
  '@porcelain/reviews/ReplyToCommentOptions',
  ReplyToCommentOptionsShape
>('@porcelain/reviews/ReplyToCommentOptions');
