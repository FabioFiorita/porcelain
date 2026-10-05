import { useEffect } from 'react';
import { FileDrafts, fileDraftRuntime } from '@porcelain/client/files';

export function useUnsavedDraftsGuard(environmentIds: readonly string[]) {
  useEffect(() => {
    if (environmentIds.length === 0) return;
    const leaving = (event: BeforeUnloadEvent) => {
      if (fileDraftRuntime.runSync(FileDrafts).hasUnsaved(environmentIds))
        event.preventDefault();
    };
    window.addEventListener('beforeunload', leaving);
    return () => window.removeEventListener('beforeunload', leaving);
  }, [environmentIds]);
}
