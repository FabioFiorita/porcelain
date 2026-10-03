import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accessApi } from '../api';
import { useAccessStore } from '../store';
import { ConnectionError } from '@porcelain/client/transport';
import { saveFileDrafts } from '@/shared/query/file-drafts';
import { unsavedDraftsMessage } from '../rules/connection-error-message';

async function disconnectSession() {
  const connection = useAccessStore.getState().connection;
  try {
    if (connection && !(await saveFileDrafts(connection.environmentId)))
      throw new ConnectionError(unsavedDraftsMessage);
    await accessApi.session.disconnect();
  } catch (error) {
    throw error instanceof ConnectionError
      ? error
      : new ConnectionError(
          'Could not disconnect. Check the connection and try again.',
          { cause: error },
        );
  }
}

export function useDisconnect() {
  const client = useQueryClient();
  const mutation = useMutation({
    scope: { id: 'access.session' },
    mutationFn: disconnectSession,
    onSuccess: async () => {
      useAccessStore.getState().clear();
      await client.cancelQueries();
      client.clear();
    },
  });
  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
