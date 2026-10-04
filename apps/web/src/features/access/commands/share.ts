import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shareCommands } from '@porcelain/client/access';
import { issuedLink } from '../rules/share';
import { type Connection } from '@/shared/workspace/connection';

export function useIssuePairing(connection: Connection) {
  const commands = shareCommands(connection, useQueryClient());
  const mutation = useMutation({
    mutationFn: async (input: {
      label: string;
      addresses: string[];
      trusted: boolean;
    }) => issuedLink(await commands.issue(input)),
  });
  return {
    submit: mutation.mutateAsync,
    onSubmit: mutation.mutate,
    issued: mutation.data ?? null,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export function useRevokeAccess(connection: Connection) {
  const commands = shareCommands(connection, useQueryClient());
  const mutation = useMutation({
    mutationFn: commands.revoke,
  });
  return {
    submit: mutation.mutateAsync,
    onSubmit: mutation.mutate,
    pendingId: mutation.isPending ? mutation.variables : undefined,
    error: mutation.error,
  };
}

export function useSetDeviceTrust(connection: Connection) {
  const commands = shareCommands(connection, useQueryClient());
  const mutation = useMutation({
    mutationFn: commands.trust,
  });
  return {
    submit: mutation.mutateAsync,
    onSubmit: mutation.mutate,
    pendingId: mutation.isPending ? mutation.variables.id : undefined,
    error: mutation.error,
  };
}

export function useSetRemoteAccess(connection: Connection) {
  const commands = shareCommands(connection, useQueryClient());
  const mutation = useMutation({
    mutationFn: commands.setRemote,
  });
  return {
    submit: mutation.mutateAsync,
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export function useRenameEnvironment(connection: Connection) {
  const commands = shareCommands(connection, useQueryClient());
  const mutation = useMutation({
    mutationFn: commands.rename,
  });
  return {
    submit: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
}

export function useStartServiceUpdate(connection: Connection) {
  const commands = shareCommands(connection, useQueryClient());
  const mutation = useMutation({
    mutationFn: commands.startServiceUpdate,
  });
  return {
    submit: mutation.mutateAsync,
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
