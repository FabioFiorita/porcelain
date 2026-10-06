import { renameProjectRequestSchema } from '@porcelain/contracts/projects';
import { useAtom, useAtomSet } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { renameProject } from '@porcelain/client/projects';
import { type Connection } from '@/shared/workspace/connection';

export function useRenameProject(connection: Connection, close: () => void) {
  const atom = renameProject(connection);
  const [result, run] = useAtom(atom, { mode: 'promise' });
  const reset = useAtomSet(atom);
  return {
    result,
    submit: async (input: { projectId: string; name: string }) => {
      try {
        await run(input);
        close();
      } catch {
        return;
      }
    },
    onCloseChange: (open: boolean) => {
      if (!open && !result.waiting) reset(Atom.Reset);
    },
  };
}
export const renameProjectValidator = renameProjectRequestSchema;
