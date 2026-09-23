import { request as httpRequest } from 'node:http';
import { createInterface } from 'node:readline';
import { ownerSocketPath } from '../lifecycle/owner-socket.ts';

const accept = 'application/json, text/event-stream';

type Answer = { status: number; body: string };

function exchange(
  socketPath: string,
  message: unknown,
  timeoutMs: number,
  cwd: string,
): Promise<Answer> {
  const payload = JSON.stringify(message);
  return new Promise((resolve, reject) => {
    const call = httpRequest(
      {
        socketPath,
        path: '/mcp',
        method: 'POST',
        timeout: timeoutMs,
        agent: false,
        headers: {
          accept,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          'x-porcelain-cwd': cwd,
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
      },
    );
    call.on('timeout', () =>
      call.destroy(new Error('The Porcelain server did not answer in time.')),
    );
    call.on('error', (error: NodeJS.ErrnoException) =>
      reject(
        error.code === 'ENOENT' || error.code === 'ECONNREFUSED'
          ? new Error('Porcelain is not running.')
          : error,
      ),
    );
    call.write(payload);
    call.end();
  });
}

function idOf(message: unknown): string | number | null {
  if (message && typeof message === 'object' && 'id' in message) {
    const id = (message as { id: unknown }).id;
    if (typeof id === 'string' || typeof id === 'number') return id;
  }
  return null;
}

export async function runMcpBridge(
  dataDirectory: string,
  input: NodeJS.ReadableStream = process.stdin,
  output: (line: string) => void = (line) => process.stdout.write(line),
  timeoutMs = 120_000,
): Promise<void> {
  const socketPath = ownerSocketPath(dataDirectory);
  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
  for await (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let message: unknown;
    try {
      message = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const id = idOf(message);
    try {
      const answer = await exchange(
        socketPath,
        message,
        timeoutMs,
        process.cwd(),
      );
      if (answer.body.trim().length === 0) continue;
      if (answer.status !== 200) {
        if (id !== null) output(`${failure(id, answer.body)}\n`);
        continue;
      }
      output(`${answer.body.trim()}\n`);
    } catch (error) {
      if (id === null) continue;
      output(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32000,
            message:
              error instanceof Error
                ? error.message
                : 'The Porcelain server could not be reached.',
          },
        })}\n`,
      );
    }
  }
}

function failure(id: string | number, body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && 'jsonrpc' in parsed)
      return JSON.stringify(parsed);
  } catch {
  }
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: {
      code: -32000,
      message: 'The Porcelain server refused the request.',
    },
  });
}
