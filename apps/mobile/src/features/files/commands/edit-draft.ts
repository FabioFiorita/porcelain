import { useEffect, useId } from 'react';
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
      Effect.runFork(draft.finishEditing(owner, () => {}));
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
