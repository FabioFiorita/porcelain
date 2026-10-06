import { useAtom, useAtomValue } from '@effect/atom-react';
import { Effect, Exit, Cause } from 'effect';
import {
  editFile,
  retainFileDraft,
  type FileDraftHandle,
} from '@porcelain/client/files';
import type { FilesScope } from '@porcelain/client/files/rules';
import { useFileDraftState, clearEditorFile } from '../store';
import { copyText } from '@/shared/workspace/copy';
import type { RuntimeConnection } from '@porcelain/client/transport';

const withoutTrailingSlash = (path: string) => path.replace(/\/$/, '');

export function useEditFile(connection: RuntimeConnection, scope: FilesScope) {
  const command = editFile({ connection, scope });
  const [result, submit] = useAtom(command, { mode: 'promiseExit' });
  return {
    result,
    create: async (
      path: string,
      entryKind: 'file' | 'directory',
      onCreated: (path: string) => void,
    ) => {
      const completed = await submit({
        kind: 'create',
        path: withoutTrailingSlash(path),
        entryKind,
      });
      if (Exit.isFailure(completed)) throw Cause.squash(completed.cause);
      if (entryKind === 'file') onCreated(path);
    },
    move: async (path: string, destination: string) => {
      const completed = await submit({
        kind: 'move',
        path: withoutTrailingSlash(path),
        destination: withoutTrailingSlash(destination),
      });
      if (Exit.isFailure(completed)) throw Cause.squash(completed.cause);
    },
    duplicate: (
      path: string,
      destination: string,
      onDuplicated: (path: string) => void,
    ) => {
      void submit({ kind: 'copy', path, destination }).then((completed) => {
        if (Exit.isSuccess(completed)) onDuplicated(destination);
      });
    },
    trash: (path: string, onTrashed: () => void) => {
      void submit({ kind: 'trash', path: withoutTrailingSlash(path) }).then(
        (completed) => {
          if (Exit.isSuccess(completed)) onTrashed();
        },
      );
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
  const draft = useAtomValue(
    retainFileDraft({
      connection,
      scope,
      path,
      text,
      fingerprint,
    }),
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
