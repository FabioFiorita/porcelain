import { ConnectionError } from '@/shared/api/connection-error';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileDraft, type FileDraftState } from '@/features/files/store';
import type { EditFileRequest as FileEdit } from '@porcelain/contracts/files';
import type { FilesConnection, FilesScope } from '../rules/scope';
import { isContentChangedError } from '../api';
import { createId } from '@/shared/lib/id';
import { useFileDraftState } from '../store';
import { retainedFileDrafts } from '@/shared/query/file-drafts';
import { asMutation } from '@/shared/query/mutation';
import { filesApi } from '../api';
import { copyText } from '@/shared/workspace/copy';

const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');

async function reload(
  client: ReturnType<typeof useQueryClient>,
  environmentId: string,
  scope: FilesScope,
  input: FileEdit,
) {
  const key = (surface: readonly unknown[]) => [
    'review',
    environmentId,
    scope.projectId,
    scope.worktreeId,
    ...surface,
  ];
  const wanted = new Map<string, readonly unknown[]>();
  const want = (surface: readonly unknown[]) =>
    wanted.set(JSON.stringify(surface), key(surface));
  want(['changes']);
  const dropped: (readonly unknown[])[] = [];
  if (input.kind === 'write') want(['text', input.path]);
  if (input.kind === 'create') want(['directory', parentOf(input.path)]);
  if (input.kind === 'trash') {
    want(['directory', parentOf(input.path)]);
    dropped.push(key(['text', input.path]));
  }
  if (input.kind === 'move') {
    want(['directory', parentOf(input.path)]);
    want(['directory', parentOf(input.destination)]);
    dropped.push(key(['text', input.path]));
  }
  if (input.kind !== 'write') want(['paths']);
  for (const queryKey of dropped)
    client.removeQueries({ queryKey, exact: true });
  await Promise.all(
    [...wanted.values()].map((queryKey) =>
      client.invalidateQueries({ queryKey, exact: true }),
    ),
  );
}

function releaseDrafts(connection: object, scope: FilesScope, input: FileEdit) {
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
  connection: FilesConnection,
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
    const result = await filesApi.edit(request.signal, scope.worktreeId, input);
    request.signal.throwIfAborted();
    return result;
  } finally {
    for (const draft of moving) draft.release(owner);
    if (!request.signal.aborted) {
      releaseDrafts(connection, scope, input);
      await reload(client, connection.environmentId, scope, input);
    }
  }
}

function useFileWriter(connection: FilesConnection | null, scope: FilesScope) {
  if (!connection) throw new Error('A connected environment is required');
  const client = useQueryClient();
  return (input: FileEdit) =>
    executeFileWrite(connection, scope, client, input);
}
export function useEditFile(
  connection: FilesConnection | null,
  scope: FilesScope,
) {
  const write = useFileWriter(connection, scope);
  return asMutation(useMutation({ mutationFn: write }));
}

export function useFileDraft(
  connection: FilesConnection | null,
  scope: FilesScope,
  path: string,
  text: string,
  fingerprint: string,
) {
  if (!connection) throw new Error('A connected environment is required');
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
          isContentChangedError,
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
    changedOnDisk: isContentChangedError(state.error),
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
