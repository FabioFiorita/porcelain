import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { pairEnvironment } from '@porcelain/client/access';
import { pairingPlatform, accessStore } from '../store';

export function usePairEnvironment(onPaired: () => void) {
  const controller = useRef<AbortController | null>(null);
  const mutation = useMutation({
    scope: { id: 'access.environments' },
    onSuccess: onPaired,
    mutationFn: (value: string) => {
      controller.current?.abort();
      controller.current = new AbortController();
      return pairEnvironment(
        accessStore,
        pairingPlatform(),
        value,
        controller.current.signal,
      );
    },
  });
  useEffect(() => () => controller.current?.abort(), []);
  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export function useReadEnvironments() {
  const mutation = useMutation({
    mutationFn: () => accessStore.getState().load(),
  });
  const read = mutation.mutate;
  useEffect(() => read(), [read]);
  return read;
}
