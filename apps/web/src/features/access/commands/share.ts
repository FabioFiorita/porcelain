import { useAtom } from '@effect/atom-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  issuePairing,
  revokeAccess,
  setDeviceTrust,
  setRemoteAccess,
  startServiceUpdate,
  renameEnvironment,
} from '@porcelain/client/access';
import { operationMutation } from '@/shared/query/mutation';
import type { Connection } from '@/shared/workspace/connection';

export function useIssuePairing(connection: Connection) {
  return useAtom(issuePairing(connection), { mode: 'promise' });
}
export function useRevokeAccess(connection: Connection, id: string) {
  return useAtom(revokeAccess({ connection, id }));
}
export function useSetDeviceTrust(connection: Connection, id: string) {
  return useAtom(setDeviceTrust({ connection, id }));
}
export function useSetRemoteAccess(connection: Connection) {
  return useAtom(setRemoteAccess(connection));
}
export function useStartServiceUpdate(connection: Connection) {
  return useAtom(startServiceUpdate(connection));
}
export function useRenameEnvironment(connection: Connection) {
  const client = useQueryClient();
  const mutation = useMutation(
    operationMutation(
      (name: string | null) => renameEnvironment(connection, client, name),
      connection,
    ),
  );
  return {
    submit: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
