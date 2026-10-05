import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SetFilePreferenceRequest } from '@porcelain/contracts/projects';
import { asMutation, operationMutation } from '@/shared/query/mutation';
import { setFilePreference } from '@porcelain/client/projects';
import {
  canonicalPreferencePath,
  type SetHiddenInput,
  type SetPinnedInput,
} from '@porcelain/client/projects/rules';
import { type Connection } from '@/shared/workspace/connection';

function useSetFilePreference(connection: Connection, projectId: string) {
  const client = useQueryClient();
  const mutation = asMutation(
    useMutation(
      operationMutation(
        (input: SetFilePreferenceRequest) =>
          setFilePreference(connection, client, projectId, input),
        connection,
      ),
    ),
  );
  return mutation;
}

export function useSetHidden(connection: Connection, projectId: string) {
  const mutation = useSetFilePreference(connection, projectId);
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

export function useSetPinned(connection: Connection, projectId: string) {
  const mutation = useSetFilePreference(connection, projectId);
  return {
    ...mutation,
    submit: (input: SetPinnedInput) =>
      mutation.submit({
        path: canonicalPreferencePath(input.path),
        flag: 'pinned',
        value: input.pinned,
      }),
  };
}
