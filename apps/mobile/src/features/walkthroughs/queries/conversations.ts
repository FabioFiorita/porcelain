import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readWalkthroughConversations } from '@porcelain/client/walkthroughs';
import type { Workspace } from '../../projects/index';
import { walkthroughSelection } from './walkthrough';

export type ConversationOwner = { workspace: Workspace; runId: string };

export function conversationSelection({ workspace, runId }: ConversationOwner) {
  return { ...walkthroughSelection(workspace), runId };
}

export function useConversations(owner: ConversationOwner) {
  const atom = readWalkthroughConversations(conversationSelection(owner));
  const result = useAtomValue(atom);
  return {
    view: Option.getOrUndefined(AsyncResult.value(result)),
    failed: AsyncResult.isFailure(result),
    refresh: useAtomRefresh(atom),
  };
}
