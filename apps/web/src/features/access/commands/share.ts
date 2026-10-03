import type { SetRemoteAccessRequest } from '@porcelain/contracts/access';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { shareApi } from '../api';
import {
  pairedAccessQueryOptions,
  remoteAccessQueryOptions,
  serviceUpdateQueryOptions,
} from '../queries/share';
import { issuedLink } from '../rules/share';
import { type Connection } from '@/shared/workspace/connection';

export function useIssuePairing(connection: Connection) {
  const client = useQueryClient();
  const mutation = useMutation({
    scope: { id: `share:${connection.environmentId}` },
    mutationFn: async (input: {
      label: string;
      addresses: string[];
      trusted: boolean;
    }) =>
      issuedLink(
        await shareApi(connection).issue({
          signal: connection.request().signal,
          label: input.label,
          addresses: input.addresses,
          trusted: input.trusted,
        }),
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

export function useRevokeAccess(connection: Connection) {
  const client = useQueryClient();
  const mutation = useMutation({
    scope: { id: `share:${connection.environmentId}` },
    mutationFn: (id: string) =>
      shareApi(connection).revoke({ signal: connection.request().signal, id }),
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

export function useSetDeviceTrust(connection: Connection) {
  const client = useQueryClient();
  const mutation = useMutation({
    scope: { id: `share:${connection.environmentId}` },
    mutationFn: (input: { id: string; trusted: boolean }) =>
      shareApi(connection).trust({
        signal: connection.request().signal,
        id: input.id,
        trusted: input.trusted,
      }),
    onSettled: () =>
      client.invalidateQueries({
        queryKey: pairedAccessQueryOptions(connection).queryKey,
      }),
  });
  return {
    submit: mutation.mutate,
    pendingId: mutation.isPending ? mutation.variables.id : undefined,
    error: mutation.error,
  };
}

export function useSetRemoteAccess(connection: Connection) {
  const client = useQueryClient();
  const key = remoteAccessQueryOptions(connection).queryKey;
  const mutation = useMutation({
    scope: { id: `remote-access:${connection.environmentId}` },
    mutationFn: (change: SetRemoteAccessRequest) =>
      shareApi(connection).setRemote({
        signal: connection.request().signal,
        change,
      }),
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

export function useRenameEnvironment(connection: Connection) {
  const client = useQueryClient();
  const mutation = useMutation({
    scope: { id: `environment-name:${connection.environmentId}` },
    mutationFn: (name: string | null) =>
      shareApi(connection).rename({
        signal: connection.request().signal,
        name,
      }),
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

export function useStartServiceUpdate(connection: Connection) {
  const client = useQueryClient();
  const key = serviceUpdateQueryOptions(connection).queryKey;
  const mutation = useMutation({
    scope: { id: `service-update:${connection.environmentId}` },
    mutationFn: (version: string) =>
      shareApi(connection).startServiceUpdate({
        signal: connection.request().signal,
        version,
      }),
    onSuccess: async (state) => {
      await client.cancelQueries({ queryKey: key });
      client.setQueryData(key, state);
    },
    onError: () => client.invalidateQueries({ queryKey: key }),
  });
  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
