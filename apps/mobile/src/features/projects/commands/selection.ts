import { type Context, Effect } from 'effect';
import { useAtom, useAtomRef } from '@effect/atom-react';
import { ProjectSelectionCommands } from '@porcelain/client/projects';
import {
  clientRuntime,
  pendingSelections,
} from '../../../shared/application/store';

const selectWorkspace = clientRuntime.fn(
  (
    command: Parameters<
      Context.Service.Shape<typeof ProjectSelectionCommands>['execute']
    >[0],
  ) =>
    Effect.gen(function* () {
      const selection = yield* ProjectSelectionCommands;
      yield* selection.execute(command);
    }),
  { concurrent: true },
);

export function useProjectSelectionCommands() {
  const [result, submit] = useAtom(selectWorkspace);
  const pending = useAtomRef(pendingSelections);
  return { result, submit, pending };
}
