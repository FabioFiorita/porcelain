import { readFileDrafts } from '@porcelain/client/files';
import type { Connection } from '@/shared/workspace/connection';
import { useAtomMount } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';

const unsavedDraftsGuard = Atom.family(
  ({
    connection,
    environmentIds,
  }: {
    connection: Connection | null;
    environmentIds: readonly string[];
  }) =>
    Atom.make((get) => {
      if (!connection || environmentIds.length === 0) return;
      const result = get(readFileDrafts(connection));
      const drafts = Option.getOrUndefined(AsyncResult.value(result));
      if (!drafts) return;
      const leaving = (event: BeforeUnloadEvent) => {
        if (drafts.hasUnsaved(environmentIds)) event.preventDefault();
      };
      window.addEventListener('beforeunload', leaving);
      get.addFinalizer(() =>
        window.removeEventListener('beforeunload', leaving),
      );
    }),
);

export function useUnsavedDraftsGuard(
  connection: Connection | null,
  environmentIds: readonly string[],
) {
  useAtomMount(unsavedDraftsGuard({ connection, environmentIds }));
}
