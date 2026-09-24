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
