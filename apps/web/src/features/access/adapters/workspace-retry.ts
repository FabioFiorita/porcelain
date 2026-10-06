import { useEffect } from 'react';

export function useWorkspaceRetry(reset: () => void) {
  useEffect(() => {
    window.addEventListener('focus', reset);
    window.addEventListener('online', reset);
    window.addEventListener('visibilitychange', reset);
    return () => {
      window.removeEventListener('focus', reset);
      window.removeEventListener('online', reset);
      window.removeEventListener('visibilitychange', reset);
    };
  }, [reset]);
}
