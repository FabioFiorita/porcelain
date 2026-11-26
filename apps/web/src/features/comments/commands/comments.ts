import { useAtom } from '@effect/atom-react';
import type { Atom } from 'effect/reactivity';
import type { ReviewPreviewResponse } from '@porcelain/contracts/comments';
import { useState } from 'react';
import { commandBinding, commentCommands } from '@porcelain/client/comments';
import { reviewUnavailableText } from '@porcelain/client/comments/rules';
import { commentSelection, type CommentOwner } from '../queries/comments';

function useCommand<I, A, E>(atom: Atom.AtomResultFn<I, A, E>) {
  return commandBinding(useAtom(atom, { mode: 'promiseExit' }));
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

function failureText(error: unknown, fallback: string): string {
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

export type ReviewPreview = Extract<
  ReviewPreviewResponse,
  { kind: 'available' }
>;

export function useCommentSubmission(
  save: ((text: string) => Promise<unknown>) | undefined,
  onSaved: () => void,
) {
  const [waiting, setWaiting] = useState(false);
  const [failure, setFailure] = useState<string>();
  return {
    waiting,
    failure,
    submit: async (text: string) => {
      if (!save || waiting) return;
      setWaiting(true);
      setFailure(undefined);
      try {
        await save(text);
        onSaved();
      } catch (error) {
        setFailure(failureText(error, 'The comment was not saved. Try again.'));
      }
      setWaiting(false);
    },
  };
}

export function useReviewPreview(
  owner: CommentOwner,
  onReview: (preview: ReviewPreview) => void,
) {
  const { preview } = useCommentCommands(owner);
  const [unavailable, setUnavailable] = useState<string>();
  return {
    unavailable,
    waiting: preview.waiting,
    read: async () => {
      setUnavailable(undefined);
      try {
        const answer = await preview.run(undefined);
        if (answer.kind === 'available') onReview(answer);
        else setUnavailable(reviewUnavailableText(answer.reason));
      } catch (error) {
        setUnavailable(failureText(error, 'GitHub could not be read.'));
      }
    },
  };
}

export function usePostReview(
  owner: CommentOwner,
  onPosted: (url: string) => void,
) {
  const { publish } = useCommentCommands(owner);
  const [failure, setFailure] = useState<string>();
  return {
    failure,
    waiting: publish.waiting,
    post: async (input: Parameters<typeof publish.run>[0]) => {
      setFailure(undefined);
      try {
        const answer = await publish.run(input);
        onPosted(answer.url);
      } catch (error) {
        setFailure(failureText(error, 'Nothing was posted. Try again.'));
      }
    },
  };
}

export function useRemoveComment(owner: CommentOwner, id: string) {
  const { remove } = useCommentCommands(owner);
  const [failure, setFailure] = useState<string>();
  return {
    failure,
    waiting: remove.waiting,
    remove: async () => {
      setFailure(undefined);
      try {
        await remove.run(id);
      } catch (error) {
        setFailure(failureText(error, 'The comment was not deleted.'));
      }
    },
  };
}
