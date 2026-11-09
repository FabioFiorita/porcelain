import type { ReadWalkthroughResult } from '@porcelain/contracts/walkthroughs';
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
