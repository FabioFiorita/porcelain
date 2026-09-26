import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SetFilePreferenceRequest } from '@porcelain/contracts/projects';
import type { ProjectConnection } from '../rules/connection';
import { asMutation } from '@/shared/query/mutation';
import { projectsApi } from '../api';
import { filePreferencesQueryOptions } from '../queries/file-preferences';
import {
  canonicalPreferencePath,
  type SetHiddenInput,
} from '../rules/file-preferences';

export function useSetHidden(
  connection: ProjectConnection | null,
  projectId: string,
) {
  if (!connection) throw new Error('A connected environment is required');
  const client = useQueryClient();
  const key = filePreferencesQueryOptions(
    connection.environmentId,
    projectId,
    connection.request,
  ).queryKey;
  const mutation = asMutation(
    useMutation({
      scope: {
        id: `file-preferences:${connection.environmentId}:${projectId}`,
      },
      mutationFn: async (input: SetFilePreferenceRequest) => {
        const request = connection.request();
        const response = await projectsApi.filePreferences.set(
          request.signal,
          projectId,
          input,
        );
        request.signal.throwIfAborted();
        return response;
      },
      onSuccess: async (response) => {
        await client.cancelQueries({ queryKey: key, exact: true });
        client.setQueryData(key, response);
      },
    }),
  );
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
