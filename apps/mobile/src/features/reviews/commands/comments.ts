import { COMMENT_BODY_LENGTH } from '@porcelain/contracts/shared';
import { useAtom } from '@effect/atom-react';
import { type Atom } from 'effect/reactivity';
import { Exit } from 'effect';

export function useCommentWrite<Input, A, E>(
  command: Atom.AtomResultFn<Input, A, E>,
) {
  const [result, submit] = useAtom(command, { mode: 'promiseExit' });
  return {
    result,
    send: (input: Input, onConfirmed?: () => void) => {
      void submit(input).then((exit) => {
        if (Exit.isSuccess(exit)) onConfirmed?.();
      });
    },
  };
}

export const commentBodyLimit = COMMENT_BODY_LENGTH;
