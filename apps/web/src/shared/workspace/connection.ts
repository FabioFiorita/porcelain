import type { LiveConnection } from '@porcelain/client/live';

export type Connection = LiveConnection & {
  address: string;
};

export type ConnectionContext = { connection: Connection };

export function requireConnection(connection: Connection | null): Connection {
  if (!connection) throw new Error('A connected environment is required');
  return connection;
}
