import { useEffect } from 'react';
import { readFileDrafts, type FileDrafts } from '@porcelain/client/files';
import type { Connection } from '@/shared/workspace/connection';
import { useAtomValue } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import { Option, type Context } from 'effect';

const disconnected = Atom.make(
  AsyncResult.initial<Context.Service.Shape<typeof FileDrafts>>(),
);

export function useUnsavedDraftsGuard(
  connection: Connection | null,
  environmentIds: readonly string[],
) {
  const result = useAtomValue(
    connection ? readFileDrafts(connection) : disconnected,
  );
  const drafts = Option.getOrUndefined(AsyncResult.value(result));
  useEffect(() => {
    if (!drafts || environmentIds.length === 0) return;
    const leaving = (event: BeforeUnloadEvent) => {
      if (drafts.hasUnsaved(environmentIds)) event.preventDefault();
    };
    window.addEventListener('beforeunload', leaving);
    return () => window.removeEventListener('beforeunload', leaving);
  }, [drafts, environmentIds]);
}
