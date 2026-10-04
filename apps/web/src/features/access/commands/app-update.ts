import { useMutation } from '@tanstack/react-query';
import { desktopAppUpdate } from '@/shared/adapters/desktop';

export function useInstallAppUpdate() {
  const mutation = useMutation({
    mutationFn: async () => {
      await desktopAppUpdate()?.install();
    },
  });
  return {
    submit: mutation.mutateAsync,
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
