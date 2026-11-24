import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readWalkthroughWriterSettings } from '@porcelain/client/projects';
import { walkthroughWriterStatus } from '@porcelain/client/projects/rules';
import type { DocumentProps } from '@/features/workspace/index';

export function useWalkthroughWriter(document: DocumentProps) {
  const atom = readWalkthroughWriterSettings(
    document.context.connection,
    document.scope.projectId,
  );
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const settings = Option.getOrUndefined(AsyncResult.value(result));
  const status = settings && walkthroughWriterStatus(settings);
  const failed = AsyncResult.isFailure(result);
  let block: string | undefined = 'Checking Walkthrough writer…';
  if (failed) block = 'Could not check writers on the connected computer.';
  else if (status) block = status.block;
  return {
    status,
    block,
    failed,
    checking: result.waiting,
    noWriters: settings?.models.length === 0,
    refresh,
  };
}
