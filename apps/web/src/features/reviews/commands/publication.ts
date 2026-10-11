import { useAtom } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { deleteReview } from '@porcelain/client/reviews';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function useDeleteReview(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const [result, send] = useAtom(
    deleteReview({ scope, connection: context.connection }),
  );
  return { result, send: () => send(undefined), reset: () => send(Atom.Reset) };
}
