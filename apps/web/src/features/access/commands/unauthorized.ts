import { useEffect } from 'react';
import { onUnauthorized, reportUnauthorized } from '@/shared/api/unauthorized';
import { accessSession, applicationRuntime } from '../store';

export function useSignOutWhenUnauthorized() {
  useEffect(
    () =>
      onUnauthorized(() => {
        applicationRuntime.runFork(accessSession.clear());
      }),
    [],
  );
  return reportUnauthorized;
}
