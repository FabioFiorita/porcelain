import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { onUnauthorized, reportUnauthorized } from '@/shared/api/unauthorized';
import { accessSession } from '../store';

export function useSignOutWhenUnauthorized() {
  const client = useQueryClient();
  useEffect(
    () =>
      onUnauthorized(() => {
        accessSession.clear();
        void client.cancelQueries();
        client.clear();
      }),
    [client],
  );
  return reportUnauthorized;
}
