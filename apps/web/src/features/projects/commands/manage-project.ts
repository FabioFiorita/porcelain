import { renameProjectRequestSchema } from '@porcelain/contracts/projects';
import { useAtom, useAtomMount } from '@effect/atom-react';
import { Atom, type AsyncResult } from 'effect/reactivity';
import { removeProject, renameProject } from '@porcelain/client/projects';
import type { Connection } from '@/shared/workspace/connection';

const dialogCommandLifetime = Atom.family(
  (
    command: Atom.Writable<
      AsyncResult.AsyncResult<unknown, unknown>,
      typeof Atom.Reset
    >,
  ) =>
    Atom.make((get) => {
      get.mount(command);
      const registry = get.registry;
      get.addFinalizer(() => {
        if (!registry.getNodes().has(command)) return;
        if (!registry.get(command).waiting) registry.set(command, Atom.Reset);
      });
    }),
);

export function useProjectCommand<Input, A, E>(
  command: Atom.AtomResultFn<Input, A, E>,
) {
  const operation = useAtom(command, { mode: 'promise' });
  useAtomMount(dialogCommandLifetime(command));
  return operation;
}

function useDialogCommand<Input, A, E>(
  command: Atom.AtomResultFn<Input, A, E>,
  close: () => void,
) {
  const [result, run] = useProjectCommand(command);
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
