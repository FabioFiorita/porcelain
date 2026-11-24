import { useAtom, useAtomValue } from '@effect/atom-react';
import {
  readWalkthroughWriterSettings,
  recheckWalkthroughWriterSettings,
  walkthroughWriterCheck,
} from '@porcelain/client/projects';
import type { DocumentProps } from '@/features/workspace/index';

export function useWalkthroughWriter(document: DocumentProps) {
  const { connection } = document.context;
  const { projectId } = document.scope;
  const result = useAtomValue(
    readWalkthroughWriterSettings(connection, projectId),
  );
  const [recheck, run] = useAtom(recheckWalkthroughWriterSettings(connection));
  return {
    ...walkthroughWriterCheck(result),
    checking: result.waiting || recheck.waiting,
    refresh: () => run(undefined),
  };
}
