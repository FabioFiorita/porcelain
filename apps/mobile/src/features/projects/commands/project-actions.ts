import { useAtom } from '@effect/atom-react';
import { Exit, type Cause } from 'effect';
import { renameProject, removeProject } from '@porcelain/client/projects';
import type { RuntimeConnection } from '@porcelain/client/transport';

export function useRenameProject(
  connection: RuntimeConnection,
  projectId: string,
) {
  const [result, rename] = useAtom(renameProject(connection), {
    mode: 'promiseExit',
  });
  return {
    result,
    rename: (name: string, onDone: () => void) => {
      void rename({ projectId, name }).then((exit) => {
        if (Exit.isSuccess(exit)) onDone();
      });
    },
  };
}

export function useRemoveProject(
  connection: RuntimeConnection,
  projectId: string,
) {
  const [, remove] = useAtom(removeProject(connection), {
    mode: 'promiseExit',
  });
  return (
    onDone: () => void,
    onFailure: (cause: Cause.Cause<unknown>) => void,
  ) => {
    void remove(projectId).then((exit) => {
      if (Exit.isSuccess(exit)) onDone();
      else onFailure(exit.cause);
    });
  };
}
