import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { onUnauthorized, reportUnauthorized } from '@/shared/api/unauthorized';
import { useAccessStore } from '../store';

export function useSignOutWhenUnauthorized() {
  const client = useQueryClient();
  useEffect(
    () =>
      onUnauthorized(() => {
        useAccessStore.getState().clear();
        void client.cancelQueries();
        client.clear();
      }),
    [client],
  );
  return reportUnauthorized;
}
