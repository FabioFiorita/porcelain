import { useAtomRefresh } from '@effect/atom-react';
import { Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { readWalkthroughConversations } from '@porcelain/client/walkthroughs';
import { useMountedRead } from '@/shared/query/mounted-read';
import type { DocumentProps } from '@/features/workspace/index';

export type ConversationScope = Pick<DocumentProps, 'scope' | 'context'> & {
  runId: string;
  hidden?: boolean;
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

const inactive = Atom.make(
  AsyncResult.initial<
    Atom.Success<ReturnType<typeof readWalkthroughConversations>>,
    Atom.Failure<ReturnType<typeof readWalkthroughConversations>>
  >(),
);

export function useConversations(props: ConversationScope) {
  const atom = props.hidden
    ? inactive
    : readWalkthroughConversations(conversationSelection(props));
  const result = useMountedRead(atom) ?? AsyncResult.initial();
  return {
    view: Option.getOrUndefined(AsyncResult.value(result)),
    failed: AsyncResult.isFailure(result),
    refresh: useAtomRefresh(atom),
  };
}
