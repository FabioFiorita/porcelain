import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type {
  FilePreferencesResponse,
  SetFilePreferenceRequest,
  SetHiddenInput,
} from '../domain/file-preferences';
import { canonicalPreferencePath } from '../domain/file-preferences';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useConnectedContext } from './workspace-provider';

function useFilePreferencesContext(projectId: string) {
  const { api, connection } = useConnectedContext();
  return {
    api: api.filePreferences,
    key: queryKeys.filePreferences(connection.environmentId, projectId),
    mutationScope: {
      id: `file-preferences:${connection.environmentId}:${projectId}`,
    },
    request: (signal?: AbortSignal) => ({
      projectId,
      ...connection.request(signal),
    }),
  };
}

function useFilePreferences(projectId: string) {
  const context = useFilePreferencesContext(projectId);
  return useSuspenseQuery({
    queryKey: context.key,
    queryFn: async ({ signal }) => {
      const request = context.request(signal);
      const response = await context.api.list(request);
      request.signal.throwIfAborted();
      return response;
    },
  }).data;
}

export function useHiddenPaths(projectId: string): ReadonlySet<string> {
  const response = useFilePreferences(projectId);
  return new Set(
    response.preferences
      .filter((preference) => preference.hidden)
      .map((preference) => preference.path),
  );
}

/** Project-scoped writes are serialized so full server snapshots stay ordered. */
function useSetFilePreference(projectId: string) {
  const context = useFilePreferencesContext(projectId);
  const client = useQueryClient();
  return asMutation(
    useMutation<FilePreferencesResponse, Error, SetFilePreferenceRequest>({
      scope: context.mutationScope,
      mutationFn: async (input) => {
        const request = context.request();
        const response = await context.api.set({ ...request, input });
        request.signal.throwIfAborted();
        return response;
      },
      onSuccess: async (response) => {
        await client.cancelQueries({ queryKey: context.key, exact: true });
        client.setQueryData(context.key, response);
      },
    }),
  );
}

export function useSetHidden(projectId: string) {
  const mutation = useSetFilePreference(projectId);
  return {
    ...mutation,
    submit: (input: SetHiddenInput) =>
      mutation.submit({
        path: canonicalPreferencePath(input.path),
        flag: 'hidden',
        value: input.hidden,
      }),
  };
}
