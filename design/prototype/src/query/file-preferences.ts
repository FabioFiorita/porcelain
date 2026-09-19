import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { FilePreferencesResponse } from '../contracts/file-preferences';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

export function useHiddenPaths(projectId: string): ReadonlySet<string> {
  const { api, environmentId } = useWorkspaceContext();
  const response = useSuspenseQuery({
    queryKey: queryKeys.filePreferences(environmentId, projectId),
    queryFn: ({ signal }) => api.filePreferences.list({ projectId, signal }),
  }).data;
  return new Set(
    response.preferences
      .filter((preference) => preference.hidden)
      .map((preference) => preference.path),
  );
}

/** Optimistic, so the row leaves the tree at once and comes back if the server refuses. */
export function useSetHidden(projectId: string) {
  const { api, environmentId } = useWorkspaceContext();
  const client = useQueryClient();
  const key = queryKeys.filePreferences(environmentId, projectId);
  return asMutation(
    useMutation({
      mutationFn: (input: { path: string; hidden: boolean }) =>
        api.filePreferences.set({
          projectId,
          input: { path: input.path, flag: 'hidden', value: input.hidden },
        }),
      onMutate: async (input) => {
        await client.cancelQueries({ queryKey: key });
        const previous = client.getQueryData<FilePreferencesResponse>(key);
        if (previous != null) {
          const others = previous.preferences.filter(
            (preference) => preference.path !== input.path,
          );
          client.setQueryData<FilePreferencesResponse>(key, {
            preferences: input.hidden
              ? [...others, { path: input.path, hidden: true }]
              : others,
          });
        }
        return { previous };
      },
      onError: (_error, _input, context) => {
        if (context?.previous != null)
          client.setQueryData(key, context.previous);
      },
      onSuccess: (response) => client.setQueryData(key, response),
    }),
  );
}
