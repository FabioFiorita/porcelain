import { ConnectionError } from '@porcelain/client/transport';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileDraft, type FileDraftState } from '@/features/files/store';
import type { EditFileRequest as FileEdit } from '@porcelain/contracts/files';
import type { FilesScope } from '../rules/scope';
import { editFileEndpoint } from '@porcelain/contracts/files';
import { isEndpointError } from '@porcelain/client/transport';
import { createId } from '@/shared/lib/id';
import { useFileDraftState } from '../store';
import {
  draftConnection,
  retainedFileDrafts,
} from '@/shared/query/file-drafts';
import { asMutation } from '@/shared/query/mutation';
import { editFile, refreshFileEdit } from '@porcelain/client/files';
import { copyText } from '@/shared/workspace/copy';
import { type Connection } from '@/shared/workspace/connection';

const withoutTrailingSlash = (path: string) => path.replace(/\/$/, '');

function releaseDrafts(
  connection: Connection,
  scope: FilesScope,
  input: FileEdit,
) {
  if (input.kind !== 'move' && input.kind !== 'trash') return;
  const prefix = `${JSON.stringify([scope.projectId, scope.worktreeId])}/`;
  const retained = retainedFileDrafts(connection);
  const moved = input.kind === 'move' ? input.destination : null;
  for (const key of [...retained.keys()]) {
    if (
      key !== `${prefix}${input.path}` &&
      !key.startsWith(`${prefix}${input.path}/`)
    )
      continue;
    const draft = retained.get(key);
    retained.delete(key);
    if (draft && moved !== null)
      retained.set(
        `${prefix}${moved}${key.slice(`${prefix}${input.path}`.length)}`,
        draft,
      );
  }
}

async function executeFileWrite(
  connection: Connection,
  scope: FilesScope,
  client: ReturnType<typeof useQueryClient>,
  input: FileEdit,
) {
  const prefix = `${JSON.stringify([scope.projectId, scope.worktreeId])}/`;
  const moving =
    input.kind === 'move' || input.kind === 'trash'
      ? [...retainedFileDrafts(connection)]
          .filter(
            ([key]) =>
              key === `${prefix}${input.path}` ||
              key.startsWith(`${prefix}${input.path}/`),
          )
          .map(([, draft]) => draft)
      : [];
  if (moving.some((draft) => draft.snapshot().owner !== null))
    throw new ConnectionError(
      'Finish editing this file or its open children before moving this entry.',
    );
  const owner = createId();
  for (const draft of moving) draft.claim(owner);
  const request = connection.request();
  try {
    for (const draft of moving)
      if (!(await draft.save()))
        throw new ConnectionError(
          'Save or discard the unsaved draft before moving this entry.',
        );
    const result = await editFile(connection, scope, input, request.signal);
    return result;
  } finally {
    for (const draft of moving) draft.release(owner);
    if (!request.signal.aborted) {
      releaseDrafts(connection, scope, input);
      await refreshFileEdit(client, connection, scope, input);
    }
  }
}

function useFileWriter(connection: Connection, scope: FilesScope) {
  const client = useQueryClient();
  return (input: FileEdit) =>
    executeFileWrite(draftConnection(connection), scope, client, input);
}
export function useEditFile(connection: Connection, scope: FilesScope) {
  const write = useFileWriter(connection, scope);
  const edit = asMutation(useMutation({ mutationFn: write }));
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
  connection: Connection,
  scope: FilesScope,
  path: string,
  text: string,
  fingerprint: string,
) {
  const write = useFileWriter(connection, scope);
  const entries = retainedFileDrafts(connection);
  const key = `${JSON.stringify([scope.projectId, scope.worktreeId])}/${path}`;
  const existing = entries.get(key);
  const draft =
    existing instanceof FileDraft
      ? existing
      : new FileDraft(
          text,
          fingerprint,
          async (text, expectedFingerprint) => {
            const result = await write({
              kind: 'write',
              path,
              text,
              expectedFingerprint,
            });
            if (!result.contentFingerprint)
              throw new Error('The server did not confirm the saved version.');
            return result.contentFingerprint;
          },
          (error) =>
            isEndpointError(error, editFileEndpoint, 'content_changed'),
        );
  if (!(existing instanceof FileDraft)) entries.set(key, draft);
  const state = useFileDraftState(draft);
  return { draft, state };
}

export function useFileDraftSaving(
  owner: string,
  draft: FileDraft,
  state: FileDraftState,
  notify: (message: {
    title: string;
    description: string;
    type: 'error';
  }) => void,
) {
  return {
    changedOnDisk: isEndpointError(
      state.error,
      editFileEndpoint,
      'content_changed',
    ),
    change: (text: string) => draft.change(text),
    copyDraft: () => copyText(draft.snapshot().text, 'draft'),
    notifyUnsaved: (path: string) =>
      notify({
        title: `${path} was not saved`,
        description:
          'Your draft is kept in this session. Reopen Edit to retry.',
        type: 'error',
      }),
    save: () => draft.save(),
    done: async (onDone: () => void) => {
      if (await draft.save()) {
        draft.clearEditorFile(owner);
        onDone();
      }
    },
    discard: (onDiscard: () => void) => {
      draft.clearEditorFile(owner);
      onDiscard();
    },
  };
}
