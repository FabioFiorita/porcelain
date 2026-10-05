import { Effect } from 'effect';
import { useEffect, useRef } from 'react';
import type { FileDraftHandle } from '@porcelain/client/files';

export function useDiskChangeNotice(
  draft: FileDraftHandle,
  viewer: string,
  fingerprint: string | undefined,
) {
  const previous = useRef(fingerprint);
  useEffect(() => {
    if (previous.current === fingerprint) return;
    previous.current = fingerprint;
    Effect.runFork(draft.noticeDiskChange(viewer, fingerprint));
  }, [draft, viewer, fingerprint]);
  useEffect(
    () => () => {
      Effect.runFork(draft.forgetDiskChange(viewer));
    },
    [draft, viewer],
  );
}
