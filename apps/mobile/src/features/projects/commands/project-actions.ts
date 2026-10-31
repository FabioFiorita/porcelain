import { useAtom } from '@effect/atom-react';
import { Exit } from 'effect';
import { renameProject, removeProject } from '@porcelain/client/projects';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { requestDocumentLeave } from '../store';

export function useProjectActions(
  connection: RuntimeConnection,
  projectId: string,
) {
  const [renameResult, rename] = useAtom(renameProject(connection), {
    mode: 'promiseExit',
  });
  const [removeResult, remove] = useAtom(removeProject(connection), {
    mode: 'promiseExit',
  });
  return {
    renameResult,
    removeResult,
    rename: (name: string, onDone: () => void) => {
      void rename({ projectId, name }).then((exit) => {
        if (Exit.isSuccess(exit)) onDone();
      });
    },
    remove: (onDone: () => void) =>
      requestDocumentLeave(() => {
        void remove(projectId).then((exit) => {
          if (Exit.isSuccess(exit)) onDone();
        });
      }),
  };
}
