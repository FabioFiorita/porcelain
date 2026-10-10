import { useAtom } from '@effect/atom-react';
import { editFile } from '@porcelain/client/files';
import type { RuntimeConnection } from '@porcelain/client/transport';
import type { FilesScope } from '@porcelain/client/files/rules';
import { Exit } from 'effect';
import type { EditFileRequest } from '@porcelain/contracts/files';

export type FileAction =
  | { kind: 'create'; folder: string; entryKind: 'file' | 'directory' }
  | { kind: 'move'; path: string }
  | { kind: 'trash'; path: string };

export function useEditFile(connection: RuntimeConnection, scope: FilesScope) {
  const [result, submit] = useAtom(editFile({ connection, scope }), {
    mode: 'promiseExit',
  });
  return {
    result,
    submit: (
      action: FileAction,
      value: string,
      onClose: () => void,
      onCreated: (path: string) => void,
    ) => {
      const request: EditFileRequest =
        action.kind === 'trash'
          ? action
          : action.kind === 'move'
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
