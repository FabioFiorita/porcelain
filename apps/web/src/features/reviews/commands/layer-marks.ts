import { useAtom } from '@effect/atom-react';
import { toggleLayerMark } from '@porcelain/client/reviews';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';

export function useToggleLayerMark(
  scope: ReviewScope,
  context: ConnectionContext,
) {
  const [result, toggle] = useAtom(
    toggleLayerMark({ scope, connection: context.connection }),
  );
  return { result, toggle };
}
