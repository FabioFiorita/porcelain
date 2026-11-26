import { useAtom, useAtomValue } from '@effect/atom-react';
import {
  nextWalkthroughWriter,
  readWalkthroughWriterSettings,
  recheckWalkthroughWriterSettings,
  walkthroughWriterChoice,
} from '@porcelain/client/projects';
import type { Workspace } from '../../projects/index';

export function useWalkthroughWriter(
  workspace: Pick<Workspace, 'connection' | 'scope'>,
) {
  const { connection, scope } = workspace;
  const result = useAtomValue(
    readWalkthroughWriterSettings(connection, scope.projectId),
  );
  const [recheck, run] = useAtom(recheckWalkthroughWriterSettings(connection));
  const [next, choose] = useAtom(nextWalkthroughWriter(connection, scope));
  return {
    ...walkthroughWriterChoice(result, next),
    choose,
    checking: result.waiting || recheck.waiting,
    refresh: () => run(undefined),
  };
}

export type WalkthroughWriter = ReturnType<typeof useWalkthroughWriter>;
