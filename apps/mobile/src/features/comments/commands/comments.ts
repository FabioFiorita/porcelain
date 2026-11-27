import { useState } from 'react';
import { useAtom, useAtomSet } from '@effect/atom-react';
import type { Atom } from 'effect/reactivity';
import { commandBinding, commentCommands } from '@porcelain/client/comments';
import {
  commentFailureText,
  postReviewFailureText,
  reviewUnavailableText,
  type CommentAnchor,
} from '@porcelain/client/comments/rules';
import type { ReviewPreviewResponse } from '@porcelain/contracts/comments';
import { copyToClipboard } from '../../../shared/adapters/clipboard';
import { notify as notifyCommand } from '../../../shared/application/notify';
import { useWriteAllowed } from '../../access';
import { ownerSelection, type CommentOwner } from '../queries/comments';

export type ReviewPreview = Extract<
  ReviewPreviewResponse,
  { kind: 'available' }
>;

function useBound<I, A, E>(command: Atom.AtomResultFn<I, A, E>) {
  return commandBinding(useAtom(command, { mode: 'promiseExit' }));
}

function useCommand<I, A, E>(
  owner: CommentOwner,
  command: Atom.AtomResultFn<I, A, E>,
  failureText: (error: unknown) => string,
) {
  const bound = useBound(command);
  const allowed = useWriteAllowed(owner.connection.environmentId);
  const [failure, setFailure] = useState<string>();
  return {
    failure,
    waiting: bound.waiting,
    run: async (input: I): Promise<A | undefined> => {
      if (!allowed()) return undefined;
      setFailure(undefined);
      try {
        return await bound.run(input);
      } catch (error) {
        setFailure(failureText(error));
        return undefined;
      }
    },
  };
}

export function useSaveComment(owner: CommentOwner) {
  const commands = commentCommands(ownerSelection(owner));
  const add = useCommand(owner, commands.add, (error) =>
    commentFailureText(error, 'The comment was not saved. Try again.'),
  );
  const edit = useCommand(owner, commands.edit, (error) =>
    commentFailureText(error, 'The comment was not saved. Try again.'),
  );
  return {
    failure: add.failure ?? edit.failure,
    waiting: add.waiting || edit.waiting,
    add: (anchor: CommentAnchor, text: string) => add.run({ anchor, text }),
    edit: (commentId: string, text: string) => edit.run({ commentId, text }),
  };
}

export function useRemoveComment(owner: CommentOwner) {
  return useCommand(
    owner,
    commentCommands(ownerSelection(owner)).remove,
    (error) => commentFailureText(error, 'The comment was not deleted.'),
  );
}

export function useReviewPreview(owner: CommentOwner) {
  const preview = useBound(commentCommands(ownerSelection(owner)).preview);
  const [unavailable, setUnavailable] = useState<string>();
  return {
    unavailable,
    waiting: preview.waiting,
    read: async (): Promise<ReviewPreview | undefined> => {
      setUnavailable(undefined);
      try {
        const answer = await preview.run(undefined);
        if (answer.kind === 'available') return answer;
        setUnavailable(reviewUnavailableText(answer.reason));
      } catch (error) {
        setUnavailable(commentFailureText(error, 'GitHub could not be read.'));
      }
      return undefined;
    },
  };
}

export function usePostReview(owner: CommentOwner) {
  return useCommand(
    owner,
    commentCommands(ownerSelection(owner)).publish,
    postReviewFailureText,
  );
}

export function useCopyComments() {
  const notify = useAtomSet(notifyCommand);
  const [failure, setFailure] = useState<string>();
  return {
    failure,
    copy: (markdown: string) => {
      setFailure(undefined);
      copyToClipboard(markdown).then(
        () => notify({ kind: 'copy', target: 'comments' }),
        () => setFailure('The comments could not be copied.'),
      );
    },
  };
}
