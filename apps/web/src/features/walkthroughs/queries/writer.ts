import { useAtom, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  readWalkthroughWriterSettings,
  recheckWalkthroughWriterSettings,
  walkthroughWriterCheck,
} from '@porcelain/client/projects';
import { walkthroughWriterChoiceStatus } from '@porcelain/client/projects/rules';
import type { DocumentProps } from '@/features/workspace/index';
import { nextWalkthroughWriter } from '../store';

export function useWalkthroughWriter(document: DocumentProps) {
  const { connection } = document.context;
  const { projectId, worktreeId } = document.scope;
  const result = useAtomValue(
    readWalkthroughWriterSettings(connection, projectId),
  );
  const [recheck, run] = useAtom(recheckWalkthroughWriterSettings(connection));
  const [next, choose] = useAtom(
    nextWalkthroughWriter(
      `${connection.environmentId}:${projectId}:${worktreeId}`,
    ),
  );
  const settings = Option.getOrUndefined(AsyncResult.value(result));
  const check = walkthroughWriterCheck(result);
  return {
    ...check,
    status:
      next && settings
        ? walkthroughWriterChoiceStatus(next, settings.models)
        : check.status,
    settings,
    writer: next ?? settings?.writer,
    next,
    choose,
    checking: result.waiting || recheck.waiting,
    refresh: () => run(undefined),
  };
}
