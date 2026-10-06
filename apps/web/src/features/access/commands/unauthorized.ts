import { useEffect } from 'react';
import { onUnauthorized, reportUnauthorized } from '@/shared/api/unauthorized';
import { accessSession } from '../store';

export function useSignOutWhenUnauthorized() {
  useEffect(
    () =>
      onUnauthorized(() => {
        accessSession.clear();
      }),
    [],
  );
  return reportUnauthorized;
}
