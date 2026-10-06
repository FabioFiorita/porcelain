import { Context } from 'effect';
import type { EditCommentMessageOptions as EditCommentMessageOptionsShape } from '../models/edit-comment-message.ts';
export const EditCommentMessageOptions = Context.Service<
  '@porcelain/reviews/EditCommentMessageOptions',
  EditCommentMessageOptionsShape
>('@porcelain/reviews/EditCommentMessageOptions');
