import { useAtom } from '@effect/atom-react';
import {
  issuePairing,
  revokeAccess,
  setDeviceTrust,
  setRemoteAccess,
  setWaysInPermission,
  renameEnvironment,
  setEnvironmentIcon,
} from '@porcelain/client/access';
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
export function useSetWaysInPermission(connection: Connection, id: string) {
  return useAtom(setWaysInPermission({ connection, id }));
}
export function useSetRemoteAccess(connection: Connection) {
  return useAtom(setRemoteAccess(connection));
}
export function useRenameEnvironment(connection: Connection) {
  return useAtom(renameEnvironment(connection), { mode: 'promise' });
}
export function useSetEnvironmentIcon(connection: Connection) {
  return useAtom(setEnvironmentIcon(connection));
}
