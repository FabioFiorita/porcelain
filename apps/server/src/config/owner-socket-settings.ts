import { join } from 'node:path';
import { SocketPathTooLongError } from './errors/socket-path-too-long-error.ts';

const pathLimit = 103;
const socketFileName = 'server.sock';

export function ownerSocketPath(directory: string): string {
  const path = join(directory, socketFileName);
  if (Buffer.byteLength(path) > pathLimit)
    throw new SocketPathTooLongError(path, pathLimit);
  return path;
}
