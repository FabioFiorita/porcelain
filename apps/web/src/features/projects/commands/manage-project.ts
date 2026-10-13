import { renameProjectRequestSchema } from '@porcelain/contracts/projects';
import { useAtom, useAtomSet } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { useEffect, useEffectEvent } from 'react';
import { removeProject, renameProject } from '@porcelain/client/projects';
import type { Connection } from '@/shared/workspace/connection';

function useDialogCommand<Input, A, E>(
  command: Atom.AtomResultFn<Input, A, E>,
  close: () => void,
) {
  const [result, run] = useAtom(command, { mode: 'promise' });
  const reset = useAtomSet(command);
  const release = useEffectEvent(() => {
    if (!result.waiting) reset(Atom.Reset);
  });
  useEffect(() => () => release(), []);
  return {
    result,
    submit: (input: Input) => run(input).then(close, () => undefined),
  };
}

export function useRenameProject(connection: Connection, close: () => void) {
  return useDialogCommand(renameProject(connection), close);
}

export function useRemoveProject(connection: Connection, close: () => void) {
  return useDialogCommand(removeProject(connection), close);
}

export const renameProjectValidator = renameProjectRequestSchema;
