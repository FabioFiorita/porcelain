import { renameProjectRequestSchema } from '@porcelain/contracts/projects';
import { useCommand } from '@/shared/lib/use-command';
import type { Atom } from 'effect/reactivity';
import { removeProject, renameProject } from '@porcelain/client/projects';
import type { Connection } from '@/shared/workspace/connection';

function useDialogCommand<Input, A, E>(
  command: Atom.AtomResultFn<Input, A, E>,
  close: () => void,
) {
  const [result, run] = useCommand(command);
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
