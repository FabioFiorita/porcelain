import type { ErrorComponentProps } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useResetQueryErrors } from '../../query/client';

export function WorkspaceError({ reset }: ErrorComponentProps) {
  const resetQueries = useResetQueryErrors();
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

  return (
    <section role="alert" className="flex flex-col gap-3 p-6">
      <p>Could not display the workspace.</p>
      <p className="text-muted-foreground">
        Porcelain will retry when the connection returns or this window becomes
        active again.
      </p>
    </section>
  );
}
