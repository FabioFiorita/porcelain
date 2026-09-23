import { request as httpRequest } from 'node:http';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';

export class OwnerRequestError extends Error {
  override readonly name = 'OwnerRequestError';
}

export async function askOwner(
  dataDirectory: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  timeoutMs = 10_000,
): Promise<unknown> {
  const socketPath = ownerSocketPath(dataDirectory);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const call = httpRequest(
      {
        socketPath,
        path,
        method,
        timeout: timeoutMs,
        agent: false,
        headers: payload
          ? {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload),
            }
          : {},
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (response.statusCode !== 200) {
            reject(
              new OwnerRequestError(messageFrom(text, response.statusCode)),
            );
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch {
            reject(
              new OwnerRequestError('The server answered unrecognizably.'),
            );
          }
        });
      },
    );
    call.on('timeout', () =>
      call.destroy(new OwnerRequestError('The server did not answer in time.')),
    );
    call.on('error', (error: NodeJS.ErrnoException) =>
      reject(
        error.code === 'ENOENT' || error.code === 'ECONNREFUSED'
          ? new OwnerRequestError(
              `Porcelain is not running for ${dataDirectory}.`,
            )
          : new OwnerRequestError(error.message),
      ),
    );
    if (payload) call.write(payload);
    call.end();
  });
}

function messageFrom(text: string, status: number | undefined): string {
  try {
    const body: unknown = JSON.parse(text);
    if (
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
    )
      return body.message;
  } catch {}
  return `The server answered ${status ?? 'nothing'}.`;
}
