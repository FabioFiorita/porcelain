import { type Context, Effect, Exit } from 'effect';
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
  const [result, run] = useAtom(selectWorkspace, { mode: 'promiseExit' });
  const pending = useAtomRef(pendingSelections);
  return {
    result,
    pending,
    submit: (command: Parameters<typeof run>[0], onDone?: () => void) => {
      void run(command).then((exit) => {
        if (Exit.isSuccess(exit)) onDone?.();
      });
    },
  };
}
