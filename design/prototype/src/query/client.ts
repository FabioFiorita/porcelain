import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/api';

/** The errors that mean this browser is not (or no longer) a paired device. */
export const isConnectionError = (error: unknown): error is ApiError =>
  error instanceof ApiError &&
  (error.code === 'NOT_PAIRED' || error.code === 'DEVICE_REVOKED');

/**
 * Same defaults as apps/web: data is fresh until something invalidates it, and
 * nothing refetches on window focus or reconnect: the live channel says when a
 * read is out of date. A pairing error from any read or write reaches
 * `onConnectionError`, so the app can show the pairing screen.
 */
export function createQueryClient(
  onConnectionError: (error: ApiError) => void,
) {
  const report = (error: unknown) => {
    if (isConnectionError(error)) onConnectionError(error);
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError: report }),
    mutationCache: new MutationCache({ onError: report }),
    defaultOptions: {
      queries: {
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });
}
