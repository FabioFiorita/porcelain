import { queryOptions, useQuery } from '@tanstack/react-query';
import { desktopAppUpdate } from '@/shared/adapters/desktop';

function appUpdateQueryOptions() {
  return queryOptions({
    queryKey: ['desktop-app-update'],
    queryFn: async () => {
      const update = desktopAppUpdate();
      return update
        ? { current: update.current(), ...(await update.check()) }
        : null;
    },
    retry: false,
  });
}

export function useAppUpdate() {
  return useQuery(appUpdateQueryOptions());
}
