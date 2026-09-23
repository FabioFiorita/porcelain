import { request as httpRequest } from 'node:http';
import {
  readOwnerStatusResponseSchema,
  type ReadOwnerStatusResponse,
} from '@porcelain/contracts/access';

export type OwnerProbe =
  | { kind: 'running'; status: ReadOwnerStatusResponse }
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
          const parsed = readOwnerStatusResponseSchema.safeParse(
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
