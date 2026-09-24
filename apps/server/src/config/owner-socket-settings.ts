import { join } from 'node:path';
import { SocketPathTooLongError } from './errors/socket-path-too-long-error.ts';
import { LIMITS } from './limits.ts';

const SOCKET_FILE_NAME = 'server.sock';

export function ownerSocketPath(directory: string): string {
  const path = join(directory, SOCKET_FILE_NAME);
  const limit = LIMITS.owner.socketPathBytes;
  if (Buffer.byteLength(path) > limit)
    throw new SocketPathTooLongError(path, limit);
  return path;
}
