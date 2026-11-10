import type { ReadWalkthroughResult } from '@porcelain/contracts/walkthroughs';
import type { WalkthroughConversationsResult } from '@porcelain/contracts/walkthroughs';
export function presentWalkthrough(run: ReadWalkthroughResult) {
  const fields = {
    ...run,
    pullRequestNumber: run.pullRequestNumber,
    sessionId: run.sessionId,
  };
  if (run.state.status !== 'ready') return { ...fields, state: run.state };
  return {
    ...fields,
    state: {
      ...run.state,
      costUsd: run.state.costUsd,
      content: {
        ...run.state.content,
        checks: run.state.content.checks,
        stops: run.state.content.stops.map((stop) => ({
          ...stop,
          attention: stop.attention,
        })),
      },
    },
  };
}
type AnswerState = Extract<
  WalkthroughConversationsResult['conversations'][number]['messages'][number],
  { author: 'agent' }
>['state'];
function presentAnswerState(state: AnswerState) {
  return state.status === 'answered'
    ? { ...state, costUsd: state.costUsd }
    : state;
}
export function presentWalkthroughConversations(
  view: WalkthroughConversationsResult,
) {
  return {
    runId: view.runId,
    pullRequestNumber: view.pullRequestNumber,
    conversations: view.conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.author === 'developer'
          ? message
          : { ...message, state: presentAnswerState(message.state) },
      ),
    })),
  };
}
