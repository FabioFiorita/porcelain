import { useAtom, useAtomMount } from '@effect/atom-react';
import { Atom, type AsyncResult } from 'effect/reactivity';
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

export function useCommand<Input, A, E>(
  command: Atom.AtomResultFn<Input, A, E>,
) {
  const operation = useAtom(command, { mode: 'promise' });
  useAtomMount(dialogCommandLifetime(command));
  return operation;
}
