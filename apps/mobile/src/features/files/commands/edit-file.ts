import { useAtom } from '@effect/atom-react';
import { editFile } from '@porcelain/client/files';
import type { RuntimeConnection } from '@porcelain/client/transport';
import type { FilesScope } from '@porcelain/client/files/rules';
import { Cause, Exit } from 'effect';
import { fileErrorMessage } from '@porcelain/client/files/rules';
import type { EditFileRequest } from '@porcelain/contracts/files';

export type FileAction =
  | { kind: 'create'; folder: string; entryKind: 'file' | 'directory' }
  | { kind: 'move'; path: string };

export function useEditFile(connection: RuntimeConnection, scope: FilesScope) {
  const [result, submit] = useAtom(editFile({ connection, scope }), {
    mode: 'promiseExit',
  });
  return {
    result,
    trash: (path: string, onFailure: (message: string) => void) => {
      void submit({ kind: 'trash', path }).then((exit) => {
        if (Exit.isFailure(exit))
          onFailure(fileErrorMessage(Cause.squash(exit.cause)));
      });
    },
    submit: (
      action: FileAction,
      value: string,
      onClose: () => void,
      onCreated: (path: string) => void,
    ) => {
      const request: EditFileRequest =
        action.kind === 'move'
          ? { ...action, destination: value }
          : {
              kind: 'create',
              entryKind: action.entryKind,
              path: `${action.folder ? `${action.folder}/` : ''}${value}`,
            };
      void submit(request).then((exit) => {
        if (Exit.isSuccess(exit)) {
          onClose();
          if (action.kind === 'create' && action.entryKind === 'file')
            onCreated(exit.value.path);
        }
      });
    },
  };
}
