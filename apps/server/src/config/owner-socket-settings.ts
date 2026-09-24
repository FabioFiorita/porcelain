import { join } from 'node:path';
import { SocketPathTooLongError } from './errors/socket-path-too-long-error.ts';

const PATH_LIMIT = 103;
const SOCKET_FILE_NAME = 'server.sock';

export function ownerSocketPath(directory: string): string {
  const path = join(directory, SOCKET_FILE_NAME);
  if (Buffer.byteLength(path) > PATH_LIMIT)
    throw new SocketPathTooLongError(path, PATH_LIMIT);
  return path;
}

export const OWNER_REQUEST_TIMEOUT_MS = 10_000;
export const OWNER_PROBE_TIMEOUT_MS = 5000;
export const OWNER_QUICK_PROBE_TIMEOUT_MS = 500;
export const OWNER_MCP_TIMEOUT_MS = 120_000;
