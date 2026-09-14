import { QueryClient, useQueryErrorResetBoundary } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        retry: false,
        // Porcelain is a companion to tools changing the checkout. Returning
        // to the window or reconnecting is the natural refresh boundary; the
        // UI should never make the user hunt for reload buttons.
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: 'always',
      },
      mutations: { retry: false },
    },
  });
}

export function useResetQueryErrors() {
  return useQueryErrorResetBoundary().reset;
}
