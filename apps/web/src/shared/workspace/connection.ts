import type { Transport } from '@porcelain/client/transport';
import type { LiveUpdatePort } from '@/shared/live/port';
import type { OperationStore } from '@/shared/query/operation-store';

export type Connection = {
  address: string;
  environmentId: string;
  controller: AbortController;
  operations: OperationStore;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
  transport: Transport;
  liveUpdates: LiveUpdatePort;
};

export type ConnectionContext = { connection: Connection };

export function requireConnection(connection: Connection | null): Connection {
  if (!connection) throw new Error('A connected environment is required');
  return connection;
}
