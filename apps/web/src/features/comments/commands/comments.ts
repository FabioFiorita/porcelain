import { useAtom } from '@effect/atom-react';
import { Cause, Exit } from 'effect';
import { AsyncResult, type Atom } from 'effect/reactivity';
import { commentCommands } from '@porcelain/client/comments';
import { commentSelection, type CommentOwner } from '../queries/comments';

function useCommand<I, A, E>(atom: Atom.AtomResultFn<I, A, E>) {
  const [result, send] = useAtom(atom, { mode: 'promiseExit' });
  return {
    waiting: AsyncResult.isWaiting(result),
    run: async (input: I) => {
      const exit = await send(input);
      if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
      return exit.value;
    },
  };
}

export function useCommentCommands(owner: CommentOwner) {
  const commands = commentCommands(commentSelection(owner));
  return {
    add: useCommand(commands.add),
    edit: useCommand(commands.edit),
    remove: useCommand(commands.remove),
    preview: useCommand(commands.preview),
    publish: useCommand(commands.publish),
  };
}

export function failureText(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.length > 0 &&
    error.message.length < 300
  )
    return error.message;
  return fallback;
}
