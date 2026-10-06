import { useAtomValue } from '@effect/atom-react';
import {
  readPairedAccess,
  readRemoteAccess,
  readServiceUpdate,
} from '@porcelain/client/access';
import type { Connection } from '@/shared/workspace/connection';

export function usePairedAccess(connection: Connection) {
  return useAtomValue(readPairedAccess(connection));
}
export function useRemoteAccess(connection: Connection) {
  return useAtomValue(readRemoteAccess(connection));
}
export function useServiceUpdate(connection: Connection) {
  return useAtomValue(readServiceUpdate(connection));
}
