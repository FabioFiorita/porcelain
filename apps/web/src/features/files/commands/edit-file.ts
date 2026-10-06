import { Effect } from 'effect';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileDrafts,
  fileDraftRuntime,
  type FileDraftHandle,
} from '@porcelain/client/files';
import type { EditFileRequest as FileEdit } from '@porcelain/contracts/files';
import type { FilesScope } from '@porcelain/client/files/rules';
import { createId } from '@/shared/lib/id';
import { useFileDraftState, clearEditorFile } from '../store';
import { asMutation } from '@/shared/query/mutation';
import { FileEditCoordinator } from '@porcelain/client/files';
import { runRequest } from '@porcelain/client/transport';
import { copyText } from '@/shared/workspace/copy';
import type { RuntimeConnection } from '@porcelain/client/transport';

const withoutTrailingSlash = (path: string) => path.replace(/\/$/, '');

function useFileWriter(connection: RuntimeConnection, scope: FilesScope) {
  const client = useQueryClient();
  return (input: FileEdit) => {
    const current = fileDraftRuntime.runSync(FileDrafts).connection(connection);
    return new FileEditCoordinator(current, scope, client, createId).execute(
      input,
    );
  };
}
export function useEditFile(connection: RuntimeConnection, scope: FilesScope) {
  const write = useFileWriter(connection, scope);
  const edit = asMutation(
    useMutation({
      mutationFn: (input: FileEdit) =>
        runRequest(
          write(input),
          fileDraftRuntime.runSync(FileDrafts).connection(connection).request()
            .signal,
        ),
    }),
  );
  return {
    ...edit,
    create: async (
      path: string,
      entryKind: 'file' | 'directory',
      onCreated: (path: string) => void,
    ) => {
      await edit.submit({
        kind: 'create',
        path: withoutTrailingSlash(path),
        entryKind,
      });
      if (entryKind === 'file') onCreated(path);
    },
    move: async (path: string, destination: string) => {
      await edit.submit({
        kind: 'move',
        path: withoutTrailingSlash(path),
        destination: withoutTrailingSlash(destination),
      });
    },
    duplicate: (
      path: string,
      destination: string,
      onDuplicated: (path: string) => void,
    ) => {
      edit
        .submit({ kind: 'copy', path, destination })
        .then(() => onDuplicated(destination))
        .catch(() => undefined);
    },
    trash: (path: string, onTrashed: () => void) => {
      edit
        .submit({ kind: 'trash', path: withoutTrailingSlash(path) })
        .then(onTrashed)
        .catch(() => undefined);
    },
  };
}

export function useFileDraft(
  connection: RuntimeConnection,
  scope: FilesScope,
  path: string,
  text: string,
  fingerprint: string,
) {
  const write = useFileWriter(connection, scope);
  const draft = fileDraftRuntime.runSync(
    FileDrafts.pipe(
      Effect.flatMap((drafts) =>
        drafts.retain({
          environmentId: connection.environmentId,
          scope,
          path,
          text,
          fingerprint,
          writer: {
            write: ({ path, text, expectedFingerprint }) =>
              write({ kind: 'write', path, text, expectedFingerprint }).pipe(
                Effect.flatMap((result) =>
                  result.contentFingerprint
                    ? Effect.succeed(result.contentFingerprint)
                    : Effect.die(
                        new Error(
                          'The server did not confirm the saved version.',
                        ),
                      ),
                ),
              ),
          },
        }),
      ),
    ),
  );
  const state = useFileDraftState(draft);
  return {
    draft,
    state,
    reset: (text: string, fingerprint: string) => {
      Effect.runFork(draft.reset(text, fingerprint));
    },
  };
}

export function useFileDraftSaving(
  owner: string,
  draft: FileDraftHandle,
  notify: (message: {
    title: string;
    description: string;
    type: 'error';
  }) => void,
) {
  return {
    changedOnDisk: draft.blocked,
    change: (text: string) => {
      Effect.runFork(draft.change(text));
    },
    copyDraft: () => copyText(draft.state.value.text, 'draft'),
    notifyUnsaved: (path: string) =>
      notify({
        title: `${path} was not saved`,
        description:
          'Your draft is kept in this session. Reopen Edit to retry.',
        type: 'error',
      }),
    save: () => Effect.runPromise(draft.save()),
    done: async (onDone: () => void) => {
      if (await Effect.runPromise(draft.save())) {
        clearEditorFile(draft, owner);
        onDone();
      }
    },
    discard: (onDiscard: () => void) => {
      clearEditorFile(draft, owner);
      onDiscard();
    },
  };
}
