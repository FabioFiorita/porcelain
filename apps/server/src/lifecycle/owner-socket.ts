import { chmodSync, statSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';
import {
  type OwnerStatusResponse,
  ownerStatusSchema,
} from '@porcelain/contracts/owner';
import { SocketPathTooLongError } from './errors/socket-path-too-long-error.ts';

const pathLimit = 103;

const socketFileName = 'server.sock';

export function ownerSocketPath(directory: string): string {
  const path = join(directory, socketFileName);
  if (Buffer.byteLength(path) > pathLimit)
    throw new SocketPathTooLongError(path, pathLimit);
  return path;
}

export type OwnerProbe =
  | { kind: 'running'; status: OwnerStatusResponse }
  | { kind: 'absent' }
  | { kind: 'unreadable'; reason: string };

function failed(reason: string): OwnerProbe {
  return { kind: 'unreadable', reason };
}

export function probeOwnerSocket(
  socketPath: string,
  timeoutMs = 5000,
): Promise<OwnerProbe> {
  return new Promise((resolve) => {
    const call = httpRequest(
      {
        socketPath,
        path: '/status',
        method: 'GET',
        timeout: timeoutMs,
        agent: false,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          if (response.statusCode !== 200) {
            resolve(
              failed(
                `the owner socket answered ${response.statusCode ?? 'nothing'}`,
              ),
            );
            return;
          }
          const parsed = ownerStatusSchema.safeParse(
            parseJson(Buffer.concat(chunks).toString('utf8')),
          );
          resolve(
            parsed.success
              ? { kind: 'running', status: parsed.data }
              : failed('the owner socket answered something unrecognizable'),
          );
        });
        response.on('error', (error: Error) => resolve(failed(error.message)));
      },
    );
    call.on('timeout', () =>
      call.destroy(new Error('the owner socket did not answer in time')),
    );
    call.on('error', (error: NodeJS.ErrnoException) =>
      resolve(
        error.code === 'ENOENT' || error.code === 'ECONNREFUSED'
          ? { kind: 'absent' }
          : failed(error.message),
      ),
    );
    call.end();
  });
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export function restrictOwnerSocket(path: string): void {
  chmodSync(path, 0o600);
  const mode = statSync(path).mode & 0o777;
  if (mode !== 0o600)
    throw new Error(
      `The owner socket ${path} has mode ${mode.toString(8).padStart(3, '0')} instead of 600.`,
    );
}
