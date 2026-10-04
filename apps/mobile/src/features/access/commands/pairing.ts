import { useMutation } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
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
    submit: mutation.mutateAsync,
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export function useReadEnvironments() {
  const mutation = useMutation({
    scope: { id: 'access.environments' },
    mutationFn: () => accessStore.getState().load(),
  });
  return mutation.mutate;
}
