import { useAtom, useAtomSet } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { removeProject } from '@porcelain/client/projects';
import type { Connection } from '@/shared/workspace/connection';

export function useRemoveProject(connection: Connection, close: () => void) {
  const atom = removeProject(connection);
  const [result, run] = useAtom(atom, { mode: 'promise' });
  const reset = useAtomSet(atom);
  return {
    result,
    confirm: (projectId: string) => {
      void run(projectId).then(close, () => undefined);
    },
    onCloseChange: (open: boolean) => {
      if (!open && !result.waiting) reset(Atom.Reset);
    },
  };
}
