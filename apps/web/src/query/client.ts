import { QueryClient, useQueryErrorResetBoundary } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });
}

export function useResetQueryErrors() {
  return useQueryErrorResetBoundary().reset;
}
