import { useEffect, useId } from 'react';
import { Alert } from 'react-native';
import { useAtomRef } from '@effect/atom-react';
import { Effect } from 'effect';
import type { FileDraftHandle } from '@porcelain/client/files';
import type { FileContents } from '../queries/text';

export function useDraftEditing(draft: FileDraftHandle, file: FileContents) {
  const owner = useId();
  const state = useAtomRef(draft.state);
  useEffect(() => {
    if (!draft.claim(owner)) return;
    draft.attachEditor(owner);
    return () => {
      Effect.runFork(
        draft.finishEditing(owner, () => {
          Alert.alert(
            'File changes not saved',
            'Your draft is kept for this session. Return to this worktree and reopen the file to save it or discard it.',
          );
        }),
      );
    };
  }, [draft, owner]);
  return {
    state,
    claimed: state.owner === owner,
    blocked: draft.blocked,
    change: (text: string) => Effect.runFork(draft.change(text)),
    save: (complete?: () => void) => {
      void Effect.runPromise(draft.save()).then((saved) => {
        if (saved) complete?.();
      });
    },
    discard: (complete: () => void) => {
      void Effect.runPromise(
        draft.reset(file.text, file.contentFingerprint ?? ''),
      ).then(complete);
    },
  };
}
