import { ConnectionError } from '@/shared/api/connection-error';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  FileDraft,
  type FileDraftState,
} from '@/features/review/model/file-draft';
import type { FileEdit, ReviewScope } from '@/features/review/model/review';
import { isContentChangedError } from '@/features/review/queries/review';
import { createId } from '@/shared/lib/id';
import { retainedFileDrafts } from '@/shared/query/file-drafts';
import { queryKeys } from '@/shared/query/keys';
import { asMutation } from '@/shared/query/mutation';
import { useConnectedContext } from '@/app/workspace-provider';

const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');

async function reload(
  client: ReturnType<typeof useQueryClient>,
  environmentId: string,
  scope: ReviewScope,
  input: FileEdit,
) {
  const key = (surface: readonly unknown[]) =>
    queryKeys.reviewSurface(environmentId, scope, surface);
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

function releaseDrafts(
  connection: object,
  scope: ReviewScope,
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

function useFileWriter(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  const client = useQueryClient();
  return async (input: FileEdit) => {
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
      const result = await api.review.editFile({ ...scope, ...request, input });
      request.signal.throwIfAborted();
      return result;
    } finally {
      for (const draft of moving) draft.release(owner);
      if (!request.signal.aborted) {
        releaseDrafts(connection, scope, input);
        await reload(client, connection.environmentId, scope, input);
      }
    }
  };
}
export function useEditFile(scope: ReviewScope) {
  const write = useFileWriter(scope);
  return asMutation(useMutation({ mutationFn: write }));
}

export function useFileDraft(
  scope: ReviewScope,
  path: string,
  text: string,
  fingerprint: string,
) {
  const { connection } = useConnectedContext();
  const write = useFileWriter(scope);
  const entries = retainedFileDrafts(connection);
  const key = `${JSON.stringify([scope.projectId, scope.worktreeId])}/${path}`;
  let draft = entries.get(key);
  if (!draft) {
    draft = new FileDraft(
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
    );
    entries.set(key, draft);
  }
  const state = useSyncExternalStore(
    draft.subscribe,
    draft.snapshot,
    draft.snapshot,
  );
  useEffect(() => {
    if (state.owner === null) draft.sync(text, fingerprint);
  }, [draft, text, fingerprint, state.owner]);
  useEffect(
    () => () => {
      const current = draft.snapshot();
      if (
        !draft.observed &&
        !current.saving &&
        current.owner === null &&
        current.text === current.savedText &&
        entries.get(key) === draft
      )
        entries.delete(key);
    },
    [draft, entries, key],
  );
  return { draft, state };
}

export function useFileDraftSaving(
  owner: string,
  path: string,
  draft: FileDraft,
  state: FileDraftState,
  onUnsaved: (path: string) => void,
) {
  const changedOnDisk = isContentChangedError(state.error);
  useEffect(() => {
    if (state.text === state.savedText || state.error || state.saving) return;
    const timer = setTimeout(() => void draft.save(), 3000);
    return () => clearTimeout(timer);
  }, [draft, state.text, state.savedText, state.error, state.saving]);

  useEffect(() => {
    return () => {
      draft.release(owner);
      if (!draft.snapshot().error)
        void draft.save().then((saved) => {
          if (!saved) onUnsaved(path);
        });
    };
  }, [draft, path, owner, onUnsaved]);

  const save = () =>
    isContentChangedError(draft.snapshot().error)
      ? Promise.resolve(false)
      : draft.save();
  const saveOnBlur = useCallback(() => {
    if (!draft.snapshot().error) void draft.save();
  }, [draft]);
  return { changedOnDisk, save, saveOnBlur };
}
