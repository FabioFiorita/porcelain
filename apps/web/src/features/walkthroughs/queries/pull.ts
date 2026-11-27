import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { readWalkthroughPull } from '@porcelain/client/walkthroughs';
import type { WalkthroughRun } from '@porcelain/client/walkthroughs/rules';
import {
  pullRequestCheckFocus,
  pullRequestDocument,
  type DocumentProps,
} from '@/features/workspace/index';

export function useWalkthroughPull(
  document: DocumentProps,
  run: Pick<WalkthroughRun, 'branch' | 'pullRequestNumber'>,
) {
  const { connection } = document.context;
  const { projectId } = document.scope;
  const focus = useAtomSet(pullRequestCheckFocus);
  const pull = useAtomValue(
    readWalkthroughPull({
      connection,
      projectId,
      branch: run.branch,
      pullRequestNumber: run.pullRequestNumber,
    }),
  );
  if (!pull) return undefined;
  return {
    ...pull,
    openCheck: (name: string | undefined) => {
      focus(
        name === undefined
          ? undefined
          : { projectId, number: pull.number, name },
      );
      document.onOpen(
        pullRequestDocument({
          projectId,
          number: pull.number,
          environmentId: connection.environmentId,
          shownOn: connection.environmentId,
        }),
      );
    },
  };
}

export type WalkthroughPull = ReturnType<typeof useWalkthroughPull>;
