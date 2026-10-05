import { useEffect, useRef } from 'react';
import type { FileDraft } from '@porcelain/client/files';

export function useDiskChangeNotice(
  draft: FileDraft,
  viewer: string,
  fingerprint: string | undefined,
) {
  const previous = useRef(fingerprint);
  useEffect(() => {
    if (previous.current === fingerprint) return;
    previous.current = fingerprint;
    draft.noticeDiskChange(viewer, fingerprint);
  }, [draft, viewer, fingerprint]);
  useEffect(() => () => draft.forgetDiskChange(viewer), [draft, viewer]);
}
