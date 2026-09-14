import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { FileDraft } from '../domain/file-draft';
import type { FileEdit, ReviewScope } from '../domain/review';
import { retainedFileDrafts } from './file-drafts';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useConnectedContext } from './workspace-provider';

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
    const owner = crypto.randomUUID();
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
      if (!request.signal.aborted)
        await client.invalidateQueries({
          queryKey: queryKeys.review(connection.environmentId, scope),
        });
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
