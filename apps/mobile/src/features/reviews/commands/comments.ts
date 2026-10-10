import { COMMENT_BODY_LENGTH } from '@porcelain/contracts/shared';
import { useAtom } from '@effect/atom-react';
import { type Atom } from 'effect/reactivity';
import { commentWriteBinding } from '@porcelain/client/reviews';

export function useCommentWrite<Input, A, E>(
  command: Atom.AtomResultFn<Input, A, E>,
) {
  return commentWriteBinding(useAtom(command, { mode: 'promiseExit' }));
}

export const commentBodyLimit = COMMENT_BODY_LENGTH;
