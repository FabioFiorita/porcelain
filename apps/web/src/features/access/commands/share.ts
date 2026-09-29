import type { SetRemoteAccessRequest } from '@porcelain/contracts/access';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { shareApi } from '../api';
import {
  pairedAccessQueryOptions,
  remoteAccessQueryOptions,
} from '../queries/share';
import { issuedLink, type ShareConnection } from '../rules/share';

export function useIssuePairing(connection: ShareConnection) {
  const client = useQueryClient();
  const mutation = useMutation({
    scope: { id: `share:${connection.environmentId}` },
    mutationFn: async (input: { label: string; addresses: string[] }) =>
      issuedLink(
        await shareApi.issue(
          connection.request().signal,
          input.label,
          input.addresses,
        ),
      ),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: pairedAccessQueryOptions(connection).queryKey,
      }),
  });
  return {
    submit: mutation.mutate,
    issued: mutation.data ?? null,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export function useRevokeAccess(connection: ShareConnection) {
  const client = useQueryClient();
  const mutation = useMutation({
    scope: { id: `share:${connection.environmentId}` },
    mutationFn: (id: string) =>
      shareApi.revoke(connection.request().signal, id),
    onSettled: () =>
      client.invalidateQueries({
        queryKey: pairedAccessQueryOptions(connection).queryKey,
      }),
  });
  return {
    submit: mutation.mutate,
    pendingId: mutation.isPending ? mutation.variables : undefined,
    error: mutation.error,
  };
}

export function useSetRemoteAccess(connection: ShareConnection) {
  const client = useQueryClient();
  const key = remoteAccessQueryOptions(connection).queryKey;
  const mutation = useMutation({
    scope: { id: `remote-access:${connection.environmentId}` },
    mutationFn: (change: SetRemoteAccessRequest) =>
      shareApi.setRemote(connection.request().signal, change),
    onSuccess: async (remote) => {
      await client.cancelQueries({ queryKey: key });
      client.setQueryData(key, remote);
    },
  });
  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export function useRenameEnvironment(connection: ShareConnection) {
  const client = useQueryClient();
  const mutation = useMutation({
    scope: { id: `environment-name:${connection.environmentId}` },
    mutationFn: (name: string | null) =>
      shareApi.rename(connection.request().signal, name),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: queryKeys.inventory(connection.environmentId),
      }),
  });
  return {
    submit: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
}
