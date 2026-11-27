import { useAtom, useAtomValue } from '@effect/atom-react';
import {
  nextWalkthroughWriter,
  readWalkthroughWriterSettings,
  recheckWalkthroughWriterSettings,
  walkthroughWriterChoice,
} from '@porcelain/client/projects';
import type { DocumentProps } from '@/features/workspace/index';

export function useWalkthroughWriter(document: DocumentProps) {
  const { connection } = document.context;
  const result = useAtomValue(
    readWalkthroughWriterSettings(connection, document.scope.projectId),
  );
  const [recheck, run] = useAtom(recheckWalkthroughWriterSettings(connection));
  const [next, choose] = useAtom(
    nextWalkthroughWriter(connection, document.scope),
  );
  return {
    ...walkthroughWriterChoice(result, next),
    choose,
    checking: result.waiting || recheck.waiting,
    refresh: () => run(undefined),
  };
}
