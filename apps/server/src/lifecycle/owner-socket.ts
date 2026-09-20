import { chmodSync, statSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';
import {
  type OwnerStatusResponse,
  ownerStatusSchema,
} from '@porcelain/contracts/owner';
import { SocketPathTooLongError } from './errors/socket-path-too-long-error.ts';

/**
 * `sun_path` holds 104 bytes on macOS and 108 on Linux, including the
 * terminator; the smaller limit is the portable one.
 */
const pathLimit = 103;

const socketFileName = 'server.sock';

/** The owner socket lives in the data directory, never at a fixed path. */
export function ownerSocketPath(directory: string): string {
  const path = join(directory, socketFileName);
  if (Buffer.byteLength(path) > pathLimit)
    throw new SocketPathTooLongError(path, pathLimit);
  return path;
}

/**
 * What is on the other end of the socket, in the three states a caller must
 * tell apart: a Porcelain server that answered, nothing listening, and
 * something there that could not be read. Only the second is safe to remove,
 * so a wedged or foreign process holding the path is never unlinked.
 */
export type OwnerProbe =
  | { kind: 'running'; status: OwnerStatusResponse }
  | { kind: 'absent' }
  | { kind: 'unreadable'; reason: string };

function failed(reason: string): OwnerProbe {
  return { kind: 'unreadable', reason };
}

/**
 * Ask the socket who it is, rather than trusting that anything accepting a
 * connection is Porcelain. Startup and `porcelain status` share this so they
 * cannot disagree about whether a directory is owned.
 */
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
        // One request, then done: a pooled socket would outlive the answer.
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

/**
 * Node cannot bind a Unix socket with a mode, so narrow it immediately and
 * confirm the result before the listener is treated as ready.  The containing
 * directory is the portable boundary; this closes the same door twice.
 */
export function restrictOwnerSocket(path: string): void {
  chmodSync(path, 0o600);
  const mode = statSync(path).mode & 0o777;
  if (mode !== 0o600)
    throw new Error(
      `The owner socket ${path} has mode ${mode.toString(8).padStart(3, '0')} instead of 600.`,
    );
}
