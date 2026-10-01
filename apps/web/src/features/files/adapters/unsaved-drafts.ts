import { useEffect } from 'react';
import { hasUnsavedFileDrafts } from '@/shared/query/file-drafts';

export function useUnsavedDraftsGuard(environmentIds: readonly string[]) {
  useEffect(() => {
    if (environmentIds.length === 0) return;
    const leaving = (event: BeforeUnloadEvent) => {
      if (hasUnsavedFileDrafts(environmentIds)) event.preventDefault();
    };
    window.addEventListener('beforeunload', leaving);
    return () => window.removeEventListener('beforeunload', leaving);
  }, [environmentIds]);
}
