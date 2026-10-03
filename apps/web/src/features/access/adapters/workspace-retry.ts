import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { useEffect } from 'react';

export function useWorkspaceRetry(reset: () => void) {
  const { reset: resetQueries } = useQueryErrorResetBoundary();
  useEffect(() => {
    const retry = () => {
      resetQueries();
      reset();
    };
    window.addEventListener('focus', retry);
    window.addEventListener('online', retry);
    window.addEventListener('visibilitychange', retry);
    return () => {
      window.removeEventListener('focus', retry);
      window.removeEventListener('online', retry);
      window.removeEventListener('visibilitychange', retry);
    };
  }, [reset, resetQueries]);
}
