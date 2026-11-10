import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readWalkthroughConversations } from '@porcelain/client/walkthroughs';
import type { DocumentProps } from '@/features/workspace/index';

export type ConversationScope = Pick<DocumentProps, 'scope' | 'context'> & {
  runId: string;
};

export function conversationSelection({
  scope,
  context,
  runId,
}: ConversationScope) {
  return {
    connection: context.connection,
    runId,
    scope: { projectId: scope.projectId, worktreeId: scope.worktreeId },
  };
}

export function useConversations(props: ConversationScope) {
  const atom = readWalkthroughConversations(conversationSelection(props));
  const result = useAtomValue(atom);
  return {
    view: Option.getOrUndefined(AsyncResult.value(result)),
    failed: AsyncResult.isFailure(result),
    refresh: useAtomRefresh(atom),
  };
}
