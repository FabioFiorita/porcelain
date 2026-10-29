import { useAtom } from '@effect/atom-react';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import { Effect, Exit, Cause } from 'effect';
import {
  editFile,
  completeFileDraft,
  type FileDraftHandle,
} from '@porcelain/client/files';
import type { FilesScope } from '@porcelain/client/files/rules';
import { readFileDraft, useFileDraftState, clearEditorFile } from '../store';
import { copyText } from '@/shared/workspace/copy';
import type { RuntimeConnection } from '@porcelain/client/transport';

const withoutTrailingSlash = (path: string) => path.replace(/\/$/, '');

export function useEditFile(connection: RuntimeConnection, scope: FilesScope) {
  const command = editFile({ connection, scope });
  const [result, submit] = useAtom(command, { mode: 'promiseExit' });
  return {
    result,
    create: (
      path: string,
      entryKind: 'file' | 'directory',
      onCreated: (path: string) => void,
    ) => {
      return submit({
        kind: 'create',
        path: withoutTrailingSlash(path),
        entryKind,
      }).then((completed) => {
        if (Exit.isFailure(completed)) throw Cause.squash(completed.cause);
        if (entryKind === 'file') onCreated(path);
      });
    },
    move: (path: string, destination: string) => {
      return submit({
        kind: 'move',
        path: withoutTrailingSlash(path),
        destination: withoutTrailingSlash(destination),
      }).then((completed) => {
        if (Exit.isFailure(completed)) throw Cause.squash(completed.cause);
      });
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
) {
  const {
    value: { file, draft },
  } = useConfirmedRead(
    readFileDraft({
      connection,
      scope,
      path,
    }),
  );
  const state = useFileDraftState(draft);
  return {
    file,
    draft,
    state,
    reset: (text: string, fingerprint: string) => {
      Effect.runFork(draft.reset(text, fingerprint));
    },
    edit: (owner: string) => {
      if (!('kind' in file) && file.contentFingerprint)
        Effect.runFork(draft.refresh(file.text, file.contentFingerprint));
      return draft.claim(owner);
    },
  };
}

export function fileDraftSaving(
  owner: string,
  draft: FileDraftHandle,
  notify: (message: {
    title: string;
    description: string;
    type: 'error';
  }) => void,
) {
  return {
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
    done: (onDone: () => void) =>
      Effect.runPromise(
        completeFileDraft(draft, () => {
          clearEditorFile(draft, owner);
          onDone();
        }),
      ),
    discard: (onDiscard: () => void) => {
      clearEditorFile(draft, owner);
      onDiscard();
    },
  };
}
