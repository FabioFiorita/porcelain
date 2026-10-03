import type { WorktreeConnection } from '@porcelain/client/transport';
import type { LiveUpdatePort } from '@/shared/live/port';
import type { OperationStore } from '@/shared/query/operation-store';

export type Connection = WorktreeConnection & {
  address: string;
  controller: AbortController;
  operations: OperationStore;
  liveUpdates: LiveUpdatePort;
};

export type ConnectionContext = { connection: Connection };

export function requireConnection(connection: Connection | null): Connection {
  if (!connection) throw new Error('A connected environment is required');
  return connection;
}
