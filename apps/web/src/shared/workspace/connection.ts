import type { EnvironmentConnection } from '@porcelain/client/access';

export type Connection = EnvironmentConnection;

export type ConnectionContext = { connection: Connection };

export function requireConnection(connection: Connection | null): Connection {
  if (!connection) throw new Error('A connected environment is required');
  return connection;
}
