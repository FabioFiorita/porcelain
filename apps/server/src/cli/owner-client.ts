import { request as httpRequest } from 'node:http';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import { OwnerRequestError } from './errors/owner-request-error.ts';
import { OwnerSocketTimeoutError } from './errors/owner-socket-timeout-error.ts';

type OwnerExchange = {
  method: 'GET' | 'POST';
  path: string;
  body?: string | undefined;
  headers?: Record<string, string> | undefined;
  timeoutMs: number;
  timeoutMessage: string;
};

type OwnerAnswer = { status: number; body: string };

function exchange(
  socketPath: string,
  call: OwnerExchange,
): Promise<OwnerAnswer> {
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(
      {
        socketPath,
        path: call.path,
        method: call.method,
        timeout: call.timeoutMs,
        agent: false,
        headers:
          call.body === undefined
            ? (call.headers ?? {})
            : {
                ...call.headers,
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(call.body),
              },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
        response.on('error', reject);
      },
    );
    outgoing.on('timeout', () =>
      outgoing.destroy(new OwnerSocketTimeoutError(call.timeoutMessage)),
    );
    outgoing.on('error', reject);
    if (call.body !== undefined) outgoing.write(call.body);
    outgoing.end();
  });
}

function socketAbsent(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ECONNREFUSED')
  );
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parsedJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function messageFrom(answer: OwnerAnswer): string {
  const body = parsedJson(answer.body);
  return body &&
    typeof body === 'object' &&
    'message' in body &&
    typeof body.message === 'string'
    ? body.message
    : `The server answered ${answer.status || 'nothing'}.`;
}

export async function askOwner(
  dataDirectory: string,
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const socketPath = ownerSocketPath(dataDirectory);
  let answer: OwnerAnswer;
  try {
    answer = await exchange(socketPath, {
      method,
      path,
      body: body === undefined ? undefined : JSON.stringify(body),
      timeoutMs,
      timeoutMessage: 'The server did not answer in time.',
    });
  } catch (error) {
    throw new OwnerRequestError(
      socketAbsent(error)
        ? `Porcelain is not running for ${dataDirectory}.`
        : reasonOf(error),
    );
  }
  if (answer.status !== 200) throw new OwnerRequestError(messageFrom(answer));
  const parsed = parsedJson(answer.body);
  if (parsed === undefined)
    throw new OwnerRequestError('The server answered unrecognizably.');
  return parsed;
}

export async function relayToOwner(
  socketPath: string,
  message: unknown,
  cwd: string,
  timeoutMs: number,
): Promise<OwnerAnswer> {
  try {
    return await exchange(socketPath, {
      method: 'POST',
      path: '/mcp',
      body: JSON.stringify(message),
      headers: {
        accept: 'application/json, text/event-stream',
        'x-porcelain-cwd': cwd,
      },
      timeoutMs,
      timeoutMessage: 'The Porcelain server did not answer in time.',
    });
  } catch (error) {
    throw socketAbsent(error)
      ? new OwnerRequestError('Porcelain is not running.')
      : error;
  }
}
